#include "certs.h"
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <DHT.h>



const char* ssid        = "YOUR_SSID";
const char* password    = "YOUR_PASSWORD";
const char* mqtt_server = "YOUR_MQTT_SERVER";


#define DHTPIN 13     
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);
const int led_pin      = 2;
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 15000;


String device_id = Network.macAddress();

WiFiClientSecure esp32Client;
PubSubClient client(esp32Client);

String topicStatus()    { return "devices/" + device_id + "/status"; }
String topicTelemetry() { return "devices/" + device_id + "/telemetry"; }
String topicCommand()   { return "devices/" + device_id + "/command"; }



void setup_wifi() {
  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi.");
}

void publishTelemetry() {
  if (!client.connected()) return;

  float h = dht.readHumidity();
  float t = dht.readTemperature(); 

  if (isnan(h) || isnan(t)) {
    Serial.println(F("Failed to read from DHT sensor!"));
    return;
  }


  JsonDocument doc;
  doc["device_id"]   = device_id;
  doc["uptime"]      = millis();
  doc["led"]         = digitalRead(led_pin) ? "ON" : "OFF";
  doc["rssi"]        = WiFi.RSSI();
  doc["temperature"] = t;
  doc["humidity"]    = h;

  char buffer[256];
  serializeJson(doc, buffer);

  bool ok = client.publish(topicTelemetry().c_str(), buffer);
  Serial.printf("Telemetry %s: %s\n", ok ? "sent" : "FAILED", buffer);
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("Message on topic: %s\n", topic);

  JsonDocument cmd;
  if (deserializeJson(cmd, payload, length)) {
    Serial.println("JSON parse failed.");
    return;
  }

  // led State
  const char* ledState = cmd["led"];
  if (ledState) {
    if (strcmp(ledState, "ON") == 0) {
      digitalWrite(led_pin, HIGH);
      Serial.println("LED ON");
    } else if (strcmp(ledState, "OFF") == 0) {
      digitalWrite(led_pin, LOW);
      Serial.println("LED OFF");
    }
  }

  //get temprature
  const char* command = cmd["command"];
  if (command) {
    if (strcmp(command, "get_temperature") == 0) {
      JsonDocument resp;
      resp["device_id"]   = device_id;
      resp["temperature"] = dht.readTemperature();
      char buf[100];
      serializeJson(resp, buf);
      bool ok = client.publish(topicTelemetry().c_str(), buf);
      Serial.printf("Temp publish %s: %s\n", ok ? "sent" : "FAILED", buf);
    }
    else if (strcmp(command, "get_humidity") == 0){
      JsonDocument humidityResp;
      humidityResp["device_id"] = device_id;
      humidityResp["humidity"] = dht.readHumidity();;
      char buffer[100];
      serializeJson(humidityResp, buffer);
      bool ok = client.publish(topicTelemetry().c_str(), buffer);
      Serial.printf("Temp publish %s: %s\n", ok ? "sent" : "FAILED", buffer);
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    esp32Client.stop();
    delay(200);

    Serial.printf("Connecting... heap=%lu\n", (unsigned long)ESP.getFreeHeap());
    String lwtPayload = "{\"device_id\":\"" + device_id + "\", \"status\":\"offline\"}";
    if (client.connect(
          device_id.c_str(),
          NULL, NULL,
          topicStatus().c_str(),
          0,
          false,
          lwtPayload.c_str()
        )) {
      Serial.println("Connected to AWS IoT.");
      client.publish(topicStatus().c_str(), "online", false);
      client.subscribe(topicCommand().c_str());
    } else {
      Serial.printf("Failed rc=%d — retrying in 5s\n", client.state());
      delay(5000);
    }
  }
}


void setup() {
  Serial.begin(115200);
  setup_wifi();
  pinMode(led_pin, OUTPUT);
  dht.begin();
  Serial.print("Device MAC Address: ");
  Serial.println(device_id);

  esp32Client.setCACert(root_ca);
  esp32Client.setCertificate(device_cert);
  esp32Client.setPrivateKey(private_key);
  esp32Client.setTimeout(30);
  esp32Client.setHandshakeTimeout(60);

  client.setServer(mqtt_server, 8883);
  client.setBufferSize(1024);
  client.setCallback(callback);
  client.setKeepAlive(60);
  client.setSocketTimeout(30);

  reconnect();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  
  if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = millis();
    publishTelemetry();
  }
}
