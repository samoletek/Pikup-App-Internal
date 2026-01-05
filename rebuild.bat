@echo off
echo Cleaning project...
rmdir /s /q android\build
rmdir /s /q android\.gradle
rmdir /s /q android\app\build

echo Creating local.properties file...
echo sdk.dir=C:\\Users\\Sebastian Perez\\AppData\\Local\\Android\\Sdk > android\local.properties

echo Installing dependencies...
call npm install

echo Cleaning Gradle cache...
cd android
call .\gradlew clean
cd ..

echo Rebuilding project...
call npx expo prebuild --platform android --clean

echo Starting Metro bundler...
call npx expo start --dev-client

echo Done!
pause 