# WebXR Distanzmesser

Kleine WebXR-Anwendung zum Messen der Bewegung eines AR-Geräts im lokalen
Koordinatensystem. Die App nutzt eine `immersive-ar`-Session mit
`local-floor`-Referenzraum und zeigt vier Werte an:

- Distanz auf der X-Achse
- Distanz auf der Y-Achse
- Distanz auf der Z-Achse
- Gesamtdistanz als euklidische Entfernung

Die Achsenwerte werden als absolute Beträge in Metern angezeigt. Gemessen wird
die Bewegung der Geräte- bzw. Viewer-Position zwischen Start und Stopp.

## Lokal starten

Es gibt keinen Build-Schritt und keine Abhängigkeiten. Die Dateien in `dist/`
können direkt von einem lokalen Webserver ausgeliefert werden:

```bash
python3 -m http.server 8080 --directory dist
```

Anschließend `http://localhost:8080` öffnen. Für einen echten AR-Test wird ein
WebXR-fähiges AR-Gerät benötigt.

## Auf Coolify deployen

Das Repository enthält ein `Dockerfile`; Coolify kann es daher direkt bauen.

1. Repository in Coolify als neue Resource hinzufügen.
2. Als Build Pack `Dockerfile` wählen.
3. Container-Port `80` verwenden.
4. Eine Domain hinterlegen und HTTPS aktivieren.
5. Deploy starten.

HTTPS ist für WebXR außerhalb von `localhost` erforderlich. Die App speichert
keine Messwerte und benötigt keine Umgebungsvariablen.

## Bedienung

1. `AR starten` drücken und Kamerazugriff erlauben.
2. Gerät am gewünschten Startpunkt ruhig halten.
3. `Messung starten` drücken.
4. Gerät zum Zielpunkt bewegen; die vier Werte aktualisieren sich live.
5. `Stoppen` drücken, um das Ergebnis einzufrieren.
