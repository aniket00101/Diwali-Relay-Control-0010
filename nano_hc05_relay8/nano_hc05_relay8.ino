/*
  Arduino Nano + HC-05 : 8-Channel Relay Diwali Light Controller
  Wiring:
    HC-05 VCC -> 5V      HC-05 GND -> GND
    HC-05 TXD -> D11     HC-05 RXD -> D12 (via 1k/2k voltage divider)
    Relay IN1..IN8 -> D2..D9
    Relay VCC -> 5V (use a separate 5V supply if possible), GND -> GND (common)

  Commands (end with newline):
    R1:1 .. R8:1   relay on        R1:0 .. R8:0   relay off
    ALL_ON, ALL_OFF
    PAT:CHASER | REVERSE | PINGPONG | ALTERNATE | BLINKALL |
        TWINKLE | FILL | CENTER | AUTO | STOP
    SPEED:<ms>     step time (100-2000)
*/
#include <SoftwareSerial.h>

SoftwareSerial bt(11, 12);  // RX = D11, TX = D12

const int NUM = 8;
const int PINS[NUM] = {2, 3, 4, 5, 6, 7, 8, 9};

// Most relay modules are ACTIVE LOW. Set to false if yours is the opposite.
const bool ACTIVE_LOW = true;

enum Pattern { P_NONE, P_CHASER, P_REVERSE, P_PINGPONG, P_ALTERNATE,
               P_BLINKALL, P_TWINKLE, P_FILL, P_CENTER, P_AUTO };
const char* NAMES[] = {"STOP", "CHASER", "REVERSE", "PINGPONG", "ALTERNATE",
                       "BLINKALL", "TWINKLE", "FILL", "CENTER", "AUTO"};

bool state[NUM];
Pattern pattern = P_NONE;
unsigned long stepMs = 300;   // keep >= 100 ms to protect relay contacts
unsigned long lastStep = 0;
unsigned int stepNo = 0;
String line = "";

void setRelay(int i, bool on) {
  state[i] = on;
  bool level = ACTIVE_LOW ? !on : on;
  digitalWrite(PINS[i], level ? HIGH : LOW);
}

void setAll(bool on) {
  for (int i = 0; i < NUM; i++) setRelay(i, on);
}

String bits() {
  String s = "";
  for (int i = 0; i < NUM; i++) s += state[i] ? '1' : '0';
  return s;
}

void sendStatus() {
  bt.print("STATUS:R=");  bt.print(bits());
  bt.print(",PAT=");      bt.print(NAMES[pattern]);
  bt.print(",SPD=");      bt.println(stepMs);
}

void sendBits() {  // short update used while a pattern runs
  bt.print("R="); bt.println(bits());
}

void frame(Pattern p, unsigned int s) {
  switch (p) {
    case P_CHASER:
      setAll(false); setRelay(s % NUM, true); break;
    case P_REVERSE:
      setAll(false); setRelay(NUM - 1 - (s % NUM), true); break;
    case P_PINGPONG: {
      int pos = s % 14; if (pos > 7) pos = 14 - pos;
      setAll(false); setRelay(pos, true); break;
    }
    case P_ALTERNATE:
      for (int i = 0; i < NUM; i++) setRelay(i, ((i + s) % 2) == 0);
      break;
    case P_BLINKALL:
      setAll(s % 2 == 0); break;
    case P_TWINKLE:
      { int r = random(NUM); setRelay(r, !state[r]); } break;
    case P_FILL: {
      int n = s % (NUM + 1);
      for (int i = 0; i < NUM; i++) setRelay(i, i < n);
      break;
    }
    case P_CENTER: {
      int n = s % 5;
      if (n == 4) setAll(false);
      else for (int i = 0; i < NUM; i++) setRelay(i, i >= 3 - n && i <= 4 + n);
      break;
    }
    default: break;
  }
}

void runStep() {
  if (pattern == P_AUTO) {
    // cycle through all patterns, 24 steps each
    Pattern sub = (Pattern)(1 + (stepNo / 24) % 8);
    frame(sub, stepNo);
  } else {
    frame(pattern, stepNo);
  }
  stepNo++;
  sendBits();
}

void setPattern(Pattern p) {
  pattern = p;
  stepNo = 0;
  lastStep = 0;
  if (p == P_NONE) setAll(false);
}

void handleCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();

  if (cmd.length() == 4 && cmd[0] == 'R' && cmd[2] == ':' &&
      cmd[1] >= '1' && cmd[1] <= '8') {
    pattern = P_NONE;                       // manual control stops patterns
    setRelay(cmd[1] - '1', cmd[3] == '1');
  } else if (cmd == "ALL_ON") {
    pattern = P_NONE; setAll(true);
  } else if (cmd == "ALL_OFF") {
    pattern = P_NONE; setAll(false);
  } else if (cmd.startsWith("PAT:")) {
    String name = cmd.substring(4);
    bool found = false;
    for (int i = 0; i < 10; i++) {
      if (name == NAMES[i]) { setAll(false); setPattern((Pattern)i); found = true; break; }
    }
    if (!found) return;
  } else if (cmd.startsWith("SPEED:")) {
    stepMs = constrain(cmd.substring(6).toInt(), 100, 2000);
  } else {
    return;
  }
  sendStatus();
}

void setup() {
  for (int i = 0; i < NUM; i++) {
    digitalWrite(PINS[i], ACTIVE_LOW ? HIGH : LOW);  // OFF before output mode
    pinMode(PINS[i], OUTPUT);
    state[i] = false;
  }
  randomSeed(analogRead(A0));
  bt.begin(9600);
  sendStatus();
}

void loop() {
  while (bt.available()) {
    char c = bt.read();
    if (c == '\n') { handleCommand(line); line = ""; }
    else if (c != '\r') { line += c; if (line.length() > 30) line = ""; }
  }

  if (pattern != P_NONE && millis() - lastStep >= stepMs) {
    lastStep = millis();
    runStep();
  }
}
