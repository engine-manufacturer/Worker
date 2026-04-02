#!/bin/bash

ANDROID_HOME="/home/codespace/android-sdk"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

echo ">>> Fixing KVM permissions..."
sudo chmod 666 /dev/kvm
echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666"' | sudo tee /etc/udev/rules.d/99-kvm.rules
sudo udevadm control --reload-rules
sudo udevadm trigger --name-match=kvm

echo ">>> Starting virtual display..."
Xvfb :1 -screen 0 1280x720x24 &
sleep 2

echo ">>> Starting Android emulator..."
DISPLAY=:1 emulator -avd test_avd -no-audio -no-boot-anim -gpu swiftshader_indirect -no-metrics &

echo ">>> Starting VNC..."
x11vnc -display :1 -nopw -listen localhost -xkb -forever &
sleep 2

echo ">>> Starting noVNC on port 6080..."
websockify --web /usr/share/novnc/ 6080 localhost:5900 &

echo ">>> Waiting for emulator to boot..."
adb wait-for-device
until adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; do
  sleep 3
done

echo ">>> Disabling animations..."
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0

echo ">>> Starting Appium on port 4723..."
appium --port 4723 &

echo "✅ All done! Android emulator and Appium are ready."
