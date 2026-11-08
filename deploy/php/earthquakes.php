<?php

require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['error' => 'Method not allowed'], 405);
}

$scope = $_GET['scope'] ?? 'ne';
$allowed = ['ne', 'global', 'significant'];
if (!in_array($scope, $allowed, true)) {
    json_response(['error' => 'Invalid scope'], 400);
}

$cacheDir = __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}

$ttl = 300;

function ne_bbox(): array
{
    return [
        'minLat' => 22.0,
        'maxLat' => 29.8,
        'minLon' => 88.0,
        'maxLon' => 97.8,
    ];
}

function is_in_ne_bbox(array $event): bool
{
    $lat = $event['lat'] ?? null;
    $lon = $event['lon'] ?? null;
    if ($lat === null || $lon === null) {
        return false;
    }

    $bbox = ne_bbox();
    return $lat >= $bbox['minLat']
        && $lat <= $bbox['maxLat']
        && $lon >= $bbox['minLon']
        && $lon <= $bbox['maxLon'];
}

function usgs_url(string $scope): string
{
    $base = 'https://earthquake.usgs.gov';

    if ($scope === 'global') {
        return $base . '/earthquakes/feed/v1.0/summary/all_day.geojson';
    }
    if ($scope === 'significant') {
        return $base . '/earthquakes/feed/v1.0/summary/significant_month.geojson';
    }

    $bbox = ne_bbox();
    $end = gmdate('c');
    $start = gmdate('c', time() - 90 * 24 * 3600);
    $params = http_build_query([
        'format' => 'geojson',
        'starttime' => $start,
        'endtime' => $end,
        'minlatitude' => (string) $bbox['minLat'],
        'maxlatitude' => (string) $bbox['maxLat'],
        'minlongitude' => (string) $bbox['minLon'],
        'maxlongitude' => (string) $bbox['maxLon'],
        'minmagnitude' => '2.5',
        'orderby' => 'time',
    ]);

    return $base . '/fdsnws/event/1/query?' . $params;
}

function normalize_feature(array $feature): ?array
{
    $props = $feature['properties'] ?? [];
    $coords = $feature['geometry']['coordinates'] ?? [];
    if (count($coords) < 2) {
        return null;
    }

    $lon = $coords[0];
    $lat = $coords[1];
    $depth = $coords[2] ?? null;

    return [
        'id' => $feature['id'] ?? ($props['code'] ?? ($props['time'] . '-' . $lat . '-' . $lon)),
        'mag' => $props['mag'] ?? null,
        'magType' => $props['magType'] ?? '—',
        'place' => $props['place'] ?? 'Unknown location',
        'time' => $props['time'] ?? null,
        'updated' => $props['updated'] ?? null,
        'depth' => $depth,
        'lat' => $lat,
        'lon' => $lon,
        'url' => $props['url'] ?? null,
        'tsunami' => ($props['tsunami'] ?? 0) === 1,
        'alert' => $props['alert'] ?? null,
        'sig' => $props['sig'] ?? null,
        'status' => $props['status'] ?? null,
        'type' => $props['type'] ?? 'earthquake',
    ];
}

function fetch_scope_events(string $scope, string $cacheDir, int $ttl): array
{
    $cacheFile = $cacheDir . '/earthquakes-' . $scope . '.json';

    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $ttl) {
        $cached = json_decode(file_get_contents($cacheFile), true);
        if (is_array($cached)) {
            return $cached;
        }
    }

    $url = usgs_url($scope);
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "User-Agent: 91SkylineWorks/1.0 (seismic-feed; contact@91skylineworks.com)\r\n",
            'timeout' => 15,
        ],
    ]);

    $raw = @file_get_contents($url, false, $context);
    if ($raw === false) {
        if (file_exists($cacheFile)) {
            $stale = json_decode(file_get_contents($cacheFile), true);
            if (is_array($stale)) {
                $stale['stale'] = true;
                return $stale;
            }
        }
        json_response(['error' => 'USGS feed unavailable'], 502);
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_response(['error' => 'Invalid USGS response'], 502);
    }

    $events = [];
    foreach ($data['features'] ?? [] as $feature) {
        if (!is_array($feature)) {
            continue;
        }
        $normalized = normalize_feature($feature);
        if ($normalized) {
            $events[] = $normalized;
        }
    }

    if ($scope === 'ne') {
        $events = array_values(array_filter($events, 'is_in_ne_bbox'));
    }

    usort($events, fn ($a, $b) => ($b['time'] ?? 0) <=> ($a['time'] ?? 0));

    $response = [
        'events' => $events,
        'fetchedAt' => round(microtime(true) * 1000),
        'source' => 'USGS',
        'scope' => $scope,
        'backfilled' => false,
    ];

    file_put_contents($cacheFile, json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    return $response;
}

$payload = fetch_scope_events($scope, $cacheDir, $ttl);
json_response($payload);
