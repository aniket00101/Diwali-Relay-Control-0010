#include <SoftwareSerial.h>

SoftwareSerial bt(11, 12);

const int NUM = 8;
const int PINS[NUM] = {2, 3, 4, 5, 6, 7, 8, 9};
const bool ACTIVE_LOW = true;

enum Pattern { P_NONE, P_CHASER, P_REVERSE, P_PINGPONG, P_ALTERNATE,
               P_BLINKALL, P_TWINKLE, P_FILL, P_CENTER, P_AUTO,
               P_COMET, P_SPARKLE, P_WAVE, P_HEARTBEAT, P_DIYA,
               P_SCAN2, P_BOUNCE2, P_INWARD, P_PAIRS, P_TRIPLE, P_QUAD, P_FILLR, P_DRAIN, P_FILLDRAIN, P_RANDOM, P_STROBE, P_HALVES, P_BINARY, P_KNIGHT, P_SPLIT, P_BLOCKS, P_RANDOM1, P_RAIN, P_SPREAD, P_MARCH, P_COUNT };
const char* NAMES[] = {"STOP", "CHASER", "REVERSE", "PINGPONG", "ALTERNATE",
                       "BLINKALL", "TWINKLE", "FILL", "CENTER", "AUTO",
                       "COMET", "SPARKLE", "WAVE", "HEARTBEAT", "DIYA",
                       "SCAN2", "BOUNCE2", "INWARD", "PAIRS", "TRIPLE", "QUAD", "FILLR", "DRAIN", "FILLDRAIN", "RANDOM", "STROBE", "HALVES", "BINARY", "KNIGHT", "SPLIT", "BLOCKS", "RANDOM1", "RAIN", "SPREAD", "MARCH"};

Pattern autoPick(unsigned int s) {
  int k = (s / 24) % (P_COUNT - 2);
  return (Pattern)(k + 1 < P_AUTO ? k + 1 : k + 2);
}

bool state[NUM];
Pattern pattern = P_NONE;
unsigned long stepMs = 300;
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

void sendBits() {
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
    case P_COMET: {                       
      int h = s % (NUM + 3);
      for (int i = 0; i < NUM; i++) setRelay(i, i <= h && i > h - 3);
      break;
    }
    case P_SPARKLE:                      
      setAll(false);
      for (int k = 0; k < 3; k++) setRelay(random(NUM), true);
      break;
    case P_WAVE: {                       
      int x = s % 12; if (x > 6) x = 12 - x;
      for (int i = 0; i < NUM; i++) setRelay(i, i == x || i == x + 1);
      break;
    }
    case P_HEARTBEAT:                 
      setAll((s % 6) == 0 || (s % 6) == 2); break;
    case P_DIYA:                      
      for (int i = 0; i < NUM; i++)
        setRelay(i, (i >= 2 && i <= 5) || random(100) < 65);
      break;
    case P_SCAN2: for (int i = 0; i < NUM; i++) setRelay(i, i == (int)(s % NUM) || i == NUM - 1 - (int)(s % NUM)); break;
    case P_BOUNCE2: { int p = s % 14; if (p > 7) p = 14 - p; for (int i = 0; i < NUM; i++) setRelay(i, i == p || i == NUM - 1 - p); } break;
    case P_INWARD: { int n = s % 5; for (int i = 0; i < NUM; i++) setRelay(i, i < n || i >= NUM - n); } break;
    case P_PAIRS: for (int i = 0; i < NUM; i++) setRelay(i, ((i / 2 + s) % 2) == 0); break;
    case P_TRIPLE: for (int i = 0; i < NUM; i++) setRelay(i, ((i + s) % 3) == 0); break;
    case P_QUAD: for (int i = 0; i < NUM; i++) setRelay(i, ((i + s) % 4) < 2); break;
    case P_FILLR: { int n = s % (NUM + 1); for (int i = 0; i < NUM; i++) setRelay(i, i >= NUM - n); } break;
    case P_DRAIN: { int n = NUM - (int)(s % (NUM + 1)); for (int i = 0; i < NUM; i++) setRelay(i, i < n); } break;
    case P_FILLDRAIN: { int x = s % 16; int n = x <= 8 ? x : 16 - x; for (int i = 0; i < NUM; i++) setRelay(i, i < n); } break;
    case P_RANDOM: for (int i = 0; i < NUM; i++) setRelay(i, random(2)); break;
    case P_STROBE: setAll((s % 4) == 0); break;
    case P_HALVES: for (int i = 0; i < NUM; i++) setRelay(i, (i < 4) == (s % 2 == 0)); break;
    case P_BINARY: for (int i = 0; i < NUM; i++) setRelay(i, (s >> i) & 1); break;
    case P_KNIGHT: { int p = s % 14; if (p > 7) p = 14 - p; for (int i = 0; i < NUM; i++) setRelay(i, abs(i - p) <= 1); } break;
    case P_SPLIT: { int n = s % 4; for (int i = 0; i < NUM; i++) setRelay(i, i == 3 - n || i == 4 + n); } break;
    case P_BLOCKS: for (int i = 0; i < NUM; i++) setRelay(i, ((i / 4 + s / 2) % 2) == 0); break;
    case P_RANDOM1: setAll(false); setRelay(random(NUM), true); break;
    case P_RAIN: for (int i = NUM - 1; i > 0; i--) setRelay(i, state[i - 1]); setRelay(0, random(100) < 35); break;
    case P_SPREAD: { for (int i = 7; i > 4; i--) setRelay(i, state[i - 1]); for (int i = 0; i < 3; i++) setRelay(i, state[i + 1]); bool r = random(100) < 35; setRelay(3, r); setRelay(4, r); } break;
    case P_MARCH: for (int i = 0; i < NUM; i++) setRelay(i, ((i + s) % 4) == 0); break;
    default: break;
  }
}

void runStep() {
  if (pattern == P_AUTO) frame(autoPick(stepNo), stepNo);
  else frame(pattern, stepNo);
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
    pattern = P_NONE;
    setRelay(cmd[1] - '1', cmd[3] == '1');
  } else if (cmd == "ALL_ON") {
    pattern = P_NONE; setAll(true);
  } else if (cmd == "ALL_OFF") {
    pattern = P_NONE; setAll(false);
  } else if (cmd.startsWith("MASK:") && cmd.length() == 5 + NUM) {   
    pattern = P_NONE;
    for (int i = 0; i < NUM; i++) setRelay(i, cmd[5 + i] == '1');
  } else if (cmd.startsWith("PAT:")) {
    String name = cmd.substring(4);
    bool found = false;
    for (int i = 0; i < P_COUNT; i++) {
      if (name == NAMES[i]) { setAll(false); setPattern((Pattern)i); found = true; break; }
    }
    if (!found) return;
  } else if (cmd.startsWith("SPEED:")) {
    stepMs = constrain(cmd.substring(6).toInt(), 100, 2000);
  } else if (cmd == "STATUS") {                                    
  } else {
    return;
  }
  sendStatus();
}

void setup() {
  for (int i = 0; i < NUM; i++) {
    digitalWrite(PINS[i], ACTIVE_LOW ? HIGH : LOW);
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
