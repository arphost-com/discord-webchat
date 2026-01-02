<?php
/**
 * Plugin Name: ARPHost LiveChat
 * Description: LiveChat widget injector and admin analytics dashboard for the ARPHost gateway.
 * Version: 0.1.0
 * Author: ARPHost
 */

if (!defined('ABSPATH')) {
    exit;
}

function arphost_livechat_get_option($key, $default = '')
{
    $opts = get_option('arphost_livechat_options', []);
    return isset($opts[$key]) ? $opts[$key] : $default;
}

function arphost_livechat_register_settings()
{
    register_setting('arphost_livechat', 'arphost_livechat_options');
}
add_action('admin_init', 'arphost_livechat_register_settings');

function arphost_livechat_menu()
{
    add_menu_page('LiveChat', 'LiveChat', 'manage_options', 'arphost-livechat', 'arphost_livechat_admin_page', 'dashicons-format-chat');
}
add_action('admin_menu', 'arphost_livechat_menu');

function arphost_livechat_admin_page()
{
    $tab = isset($_GET['tab']) ? sanitize_text_field($_GET['tab']) : 'settings';
    echo '<div class="wrap"><h1>ARPHost LiveChat</h1>';
    echo '<nav class="nav-tab-wrapper">';
    echo '<a class="nav-tab ' . ($tab==='settings'?'nav-tab-active':'') . '" href="?page=arphost-livechat&tab=settings">Settings</a>';
    echo '<a class="nav-tab ' . ($tab==='dashboard'?'nav-tab-active':'') . '" href="?page=arphost-livechat&tab=dashboard">Dashboard</a>';
    echo '</nav>';

    if ($tab === 'dashboard') {
        arphost_livechat_render_dashboard();
    } else {
        arphost_livechat_render_settings();
    }
    echo '</div>';
}

function arphost_livechat_render_settings()
{
    $opts = get_option('arphost_livechat_options', []);
    $gateway = esc_attr($opts['gateway_baseurl'] ?? 'https://livechat.arphost.com');
    $adminKey = esc_attr($opts['admin_api_key'] ?? '');
    $mapsKey = esc_attr($opts['google_maps_api_key'] ?? '');
    $enableWidget = !empty($opts['enable_widget']);
    $position = esc_attr($opts['widget_position'] ?? 'right');
    $label = esc_attr($opts['widget_label'] ?? '');
    $logoUrl = esc_attr($opts['widget_logo_url'] ?? '');
    $accent = esc_attr($opts['widget_accent'] ?? '');
    $bg = esc_attr($opts['widget_bg'] ?? '');
    $panelBg = esc_attr($opts['widget_panel_bg'] ?? '');
    $text = esc_attr($opts['widget_text'] ?? '');
    $muted = esc_attr($opts['widget_muted'] ?? '');
    $bubbleVisitor = esc_attr($opts['widget_bubble_visitor'] ?? '');
    $bubbleAgent = esc_attr($opts['widget_bubble_agent'] ?? '');
    $error = esc_attr($opts['widget_error'] ?? '');

    echo '<form method="post" action="options.php">';
    settings_fields('arphost_livechat');
    echo '<table class="form-table">';
    echo '<tr><th scope="row">Gateway Base URL</th><td><input type="text" name="arphost_livechat_options[gateway_baseurl]" value="'.$gateway.'" class="regular-text"></td></tr>';
    echo '<tr><th scope="row">Admin API Key</th><td><input type="password" name="arphost_livechat_options[admin_api_key]" value="'.$adminKey.'" class="regular-text"></td></tr>';
    echo '<tr><th scope="row">Google Maps API Key</th><td><input type="text" name="arphost_livechat_options[google_maps_api_key]" value="'.$mapsKey.'" class="regular-text"></td></tr>';
    echo '<tr><th scope="row">Inject Widget</th><td><label><input type="checkbox" name="arphost_livechat_options[enable_widget]" value="1" '.checked($enableWidget, true, false).'> Enable widget on all pages</label></td></tr>';
    echo '<tr><th scope="row">Widget Position</th><td><select name="arphost_livechat_options[widget_position]">';
    echo '<option value="right" '.selected($position, 'right', false).'>right</option>';
    echo '<option value="left" '.selected($position, 'left', false).'>left</option>';
    echo '</select></td></tr>';
    echo '<tr><th scope="row">Widget Label</th><td><input type="text" name="arphost_livechat_options[widget_label]" value="'.$label.'" class="regular-text"></td></tr>';
    echo '<tr><th scope="row">Widget Logo URL</th><td><input type="text" name="arphost_livechat_options[widget_logo_url]" value="'.$logoUrl.'" class="regular-text"></td></tr>';
    echo '<tr><th scope="row">Widget Accent</th><td><input type="text" name="arphost_livechat_options[widget_accent]" value="'.$accent.'" class="regular-text"></td></tr>';
    echo '<tr><th scope="row">Widget Background</th><td><input type="text" name="arphost_livechat_options[widget_bg]" value="'.$bg.'" class="regular-text"></td></tr>';
    echo '<tr><th scope="row">Widget Panel Background</th><td><input type="text" name="arphost_livechat_options[widget_panel_bg]" value="'.$panelBg.'" class="regular-text"></td></tr>';
    echo '<tr><th scope="row">Widget Text Color</th><td><input type="text" name="arphost_livechat_options[widget_text]" value="'.$text.'" class="regular-text"></td></tr>';
    echo '<tr><th scope="row">Widget Muted Color</th><td><input type="text" name="arphost_livechat_options[widget_muted]" value="'.$muted.'" class="regular-text"></td></tr>';
    echo '<tr><th scope="row">Widget Visitor Bubble</th><td><input type="text" name="arphost_livechat_options[widget_bubble_visitor]" value="'.$bubbleVisitor.'" class="regular-text"></td></tr>';
    echo '<tr><th scope="row">Widget Agent Bubble</th><td><input type="text" name="arphost_livechat_options[widget_bubble_agent]" value="'.$bubbleAgent.'" class="regular-text"></td></tr>';
    echo '<tr><th scope="row">Widget Error Color</th><td><input type="text" name="arphost_livechat_options[widget_error]" value="'.$error.'" class="regular-text"></td></tr>';
    echo '</table>';
    submit_button();
    echo '</form>';
}

function arphost_livechat_api_get($path)
{
    $base = rtrim(arphost_livechat_get_option('gateway_baseurl', ''), '/');
    $key = arphost_livechat_get_option('admin_api_key', '');
    if ($base === '' || $key === '') {
        return ['ok' => false, 'error' => 'missing_config'];
    }
    $url = $base . $path;
    $resp = wp_remote_get($url, [
        'headers' => ['X-Admin-Key' => $key],
        'timeout' => 10,
    ]);
    if (is_wp_error($resp)) {
        return ['ok' => false, 'error' => $resp->get_error_message()];
    }
    $body = wp_remote_retrieve_body($resp);
    $data = json_decode($body, true);
    if (!is_array($data) || empty($data['ok'])) {
        return ['ok' => false, 'error' => 'bad_response', 'raw' => $body];
    }
    return ['ok' => true, 'data' => $data];
}

function arphost_livechat_render_dashboard()
{
    $range = isset($_GET['range']) ? preg_replace('/[^a-z0-9]/i', '', $_GET['range']) : 'all';
    if ($range === '') $range = 'all';
    $resp = arphost_livechat_api_get('/api/admin/sessions?limit=200&range=' . urlencode($range));
    if (!$resp['ok']) {
        echo '<div class="notice notice-error"><p>API error: '.esc_html($resp['error']).'</p></div>';
        if (!empty($resp['raw'])) {
            echo '<pre style="white-space:pre-wrap;max-height:220px;overflow:auto;background:#f7f7f7;padding:10px;">'.esc_html($resp['raw']).'</pre>';
        }
        return;
    }
    $sessions = $resp['data']['sessions'];
    $mapKey = arphost_livechat_get_option('google_maps_api_key', '');

    $ranges = ['day' => 'Day', 'week' => 'Week', 'month' => 'Month', 'year' => 'Year', 'all' => 'All Time'];
    echo '<div style="margin:10px 0;">';
    foreach ($ranges as $key => $label) {
        $class = ($range === $key) ? 'button button-primary' : 'button';
        $url = admin_url('admin.php?page=arphost-livechat&tab=dashboard&range=' . urlencode($key));
        echo '<a class="'.$class.'" style="margin-right:6px;" href="'.esc_url($url).'">'.$label.'</a>';
    }
    echo '</div>';

    echo '<h2>Sessions</h2>';
    echo '<table class="widefat striped"><thead><tr><th>Session</th><th>Mode</th><th>Client</th><th>Name</th><th>Email</th><th>Last Page</th><th>Last Seen</th><th>Location</th></tr></thead><tbody>';
    foreach ($sessions as $s) {
        $client = !empty($s['client_id']) ? '#'.$s['client_id'] : 'Guest';
        $loc = trim(($s['geo_city'] ?? '') . ' ' . ($s['geo_region'] ?? '') . ' ' . ($s['geo_country'] ?? ''));
        if ($loc === '') $loc = '—';
        echo '<tr>';
        echo '<td><code>'.esc_html($s['session_uuid']).'</code></td>';
        echo '<td>'.esc_html($s['mode']).'</td>';
        echo '<td>'.esc_html($client).'</td>';
        echo '<td>'.esc_html($s['visitor_name'] ?: '—').'</td>';
        echo '<td>'.esc_html($s['visitor_email'] ?: '—').'</td>';
        echo '<td>'.esc_html($s['last_page_url'] ?: '—').'</td>';
        echo '<td>'.esc_html($s['last_seen_at'] ?: '—').'</td>';
        echo '<td>'.esc_html($loc).'</td>';
        echo '</tr>';
    }
    echo '</tbody></table>';

    if ($mapKey !== '') {
        $points = [];
        foreach ($sessions as $s) {
            if (!empty($s['geo_lat']) && !empty($s['geo_lng'])) {
                $points[] = [
                    'lat' => (float)$s['geo_lat'],
                    'lng' => (float)$s['geo_lng'],
                    'label' => ($s['visitor_name'] ?: 'Visitor'),
                ];
            }
        }
        echo '<h2>Map</h2>';
        echo '<div id="alp-map" style="width:100%;height:420px;"></div>';
        echo '<script src="https://maps.googleapis.com/maps/api/js?key='.esc_attr($mapKey).'"></script>';
        echo '<script src="https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js"></script>';
        echo '<script>';
        echo 'var points = ' . wp_json_encode($points) . ';';
        echo 'var center = points.length ? {lat:points[0].lat,lng:points[0].lng} : {lat:20,lng:0};';
        echo 'var map = new google.maps.Map(document.getElementById("alp-map"), {zoom:2, center:center});';
        echo 'var markers = points.map(function(p){return new google.maps.Marker({position:{lat:p.lat,lng:p.lng},title:p.label});});';
        echo 'if (window.markerClusterer && markers.length) {';
        echo '  new markerClusterer.MarkerClusterer({map: map, markers: markers});';
        echo '} else {';
        echo '  markers.forEach(function(m){m.setMap(map);});';
        echo '}';
        echo '</script>';
    } else {
        echo '<p>Add a Google Maps API key to enable the location map.</p>';
    }
}

function arphost_livechat_inject_widget()
{
    $opts = get_option('arphost_livechat_options', []);
    if (empty($opts['enable_widget'])) return;
    $base = rtrim($opts['gateway_baseurl'] ?? '', '/');
    if ($base === '') return;
    $mode = 'guest';
    $position = $opts['widget_position'] ?? '';
    $label = $opts['widget_label'] ?? '';
    $logoUrl = $opts['widget_logo_url'] ?? '';
    $accent = $opts['widget_accent'] ?? '';
    $bg = $opts['widget_bg'] ?? '';
    $panelBg = $opts['widget_panel_bg'] ?? '';
    $text = $opts['widget_text'] ?? '';
    $muted = $opts['widget_muted'] ?? '';
    $bubbleVisitor = $opts['widget_bubble_visitor'] ?? '';
    $bubbleAgent = $opts['widget_bubble_agent'] ?? '';
    $error = $opts['widget_error'] ?? '';
    $posAttr = $position !== '' ? ' data-position="'.esc_attr($position).'"' : '';
    $labelAttr = $label !== '' ? ' data-label="'.esc_attr($label).'"' : '';
    $logoAttr = $logoUrl !== '' ? ' data-logo="'.esc_attr($logoUrl).'"' : '';
    $accentAttr = $accent !== '' ? ' data-accent="'.esc_attr($accent).'"' : '';
    $bgAttr = $bg !== '' ? ' data-bg="'.esc_attr($bg).'"' : '';
    $panelBgAttr = $panelBg !== '' ? ' data-panel-bg="'.esc_attr($panelBg).'"' : '';
    $textAttr = $text !== '' ? ' data-text="'.esc_attr($text).'"' : '';
    $mutedAttr = $muted !== '' ? ' data-muted="'.esc_attr($muted).'"' : '';
    $bubbleVisitorAttr = $bubbleVisitor !== '' ? ' data-bubble-visitor="'.esc_attr($bubbleVisitor).'"' : '';
    $bubbleAgentAttr = $bubbleAgent !== '' ? ' data-bubble-agent="'.esc_attr($bubbleAgent).'"' : '';
    $errorAttr = $error !== '' ? ' data-error="'.esc_attr($error).'"' : '';
    echo '<script src="'.esc_url($base.'/widget.js?v=5').'" defer data-mode="'.esc_attr($mode).'" data-base="'.esc_attr($base).'"'.$posAttr.$labelAttr.$logoAttr.$accentAttr.$bgAttr.$panelBgAttr.$textAttr.$mutedAttr.$bubbleVisitorAttr.$bubbleAgentAttr.$errorAttr.'></script>';
}
add_action('wp_footer', 'arphost_livechat_inject_widget');
