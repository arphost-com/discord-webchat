<?php
/**
 * Plugin Name: Discord WebChat
 * Description: LiveChat widget injector and admin analytics dashboard for the Discord WebChat gateway.
 * Version: 2.0.0
 * Author: Discord WebChat
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package Discord_WebChat
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Main plugin class.
 */
final class Discord_WebChat {

    /**
     * Plugin version.
     *
     * @var string
     */
    const VERSION = '2.0.0';

    /**
     * Option name.
     *
     * @var string
     */
    const OPTION_NAME = 'discord_webchat_options';

    /**
     * Single instance.
     *
     * @var Discord_WebChat|null
     */
    private static $instance = null;

    /**
     * Get singleton instance.
     *
     * @return Discord_WebChat
     */
    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor.
     */
    private function __construct() {
        $this->init_hooks();
    }

    /**
     * Initialize hooks.
     */
    private function init_hooks() {
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_scripts' ) );
        add_action( 'wp_footer', array( $this, 'inject_widget' ) );
    }

    /**
     * Get option value.
     *
     * @param string $key     Option key.
     * @param mixed  $default Default value.
     * @return mixed
     */
    public function get_option( $key, $default = '' ) {
        $opts = get_option( self::OPTION_NAME, array() );
        return isset( $opts[ $key ] ) ? $opts[ $key ] : $default;
    }

    /**
     * Register settings.
     */
    public function register_settings() {
        register_setting(
            'discord_webchat',
            self::OPTION_NAME,
            array(
                'type'              => 'array',
                'sanitize_callback' => array( $this, 'sanitize_options' ),
                'default'           => array(),
            )
        );
    }

    /**
     * Sanitize options.
     *
     * @param array $input Input array.
     * @return array
     */
    public function sanitize_options( $input ) {
        $sanitized = array();

        if ( isset( $input['gateway_baseurl'] ) ) {
            $sanitized['gateway_baseurl'] = esc_url_raw( $input['gateway_baseurl'] );
        }

        if ( isset( $input['admin_api_key'] ) ) {
            $sanitized['admin_api_key'] = sanitize_text_field( $input['admin_api_key'] );
        }

        if ( isset( $input['google_maps_api_key'] ) ) {
            $sanitized['google_maps_api_key'] = sanitize_text_field( $input['google_maps_api_key'] );
        }

        $sanitized['enable_widget'] = ! empty( $input['enable_widget'] );

        if ( isset( $input['widget_position'] ) ) {
            $sanitized['widget_position'] = in_array( $input['widget_position'], array( 'left', 'right' ), true )
                ? $input['widget_position']
                : 'right';
        }

        // Text fields for widget customization.
        $text_fields = array(
            'widget_label',
            'widget_logo_url',
            'widget_accent',
            'widget_bg',
            'widget_panel_bg',
            'widget_text',
            'widget_muted',
            'widget_bubble_visitor',
            'widget_bubble_agent',
            'widget_error',
        );

        foreach ( $text_fields as $field ) {
            if ( isset( $input[ $field ] ) ) {
                $sanitized[ $field ] = sanitize_text_field( $input[ $field ] );
            }
        }

        return $sanitized;
    }

    /**
     * Add admin menu.
     */
    public function add_admin_menu() {
        add_menu_page(
            __( 'Discord WebChat', 'discord-webchat' ),
            __( 'Discord WebChat', 'discord-webchat' ),
            'manage_options',
            'discord-webchat',
            array( $this, 'render_admin_page' ),
            'dashicons-format-chat',
            30
        );
    }

    /**
     * Enqueue admin scripts.
     *
     * @param string $hook Current admin page hook.
     */
    public function enqueue_admin_scripts( $hook ) {
        if ( 'toplevel_page_discord-webchat' !== $hook ) {
            return;
        }

        // Only load Google Maps on dashboard tab.
        $tab = isset( $_GET['tab'] ) ? sanitize_key( $_GET['tab'] ) : 'settings';
        if ( 'dashboard' === $tab ) {
            $map_key = $this->get_option( 'google_maps_api_key' );
            if ( ! empty( $map_key ) ) {
                wp_enqueue_script(
                    'google-maps',
                    'https://maps.googleapis.com/maps/api/js?key=' . esc_attr( $map_key ),
                    array(),
                    null,
                    true
                );

                wp_enqueue_script(
                    'google-maps-cluster',
                    'https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js',
                    array( 'google-maps' ),
                    null,
                    true
                );
            }
        }
    }

    /**
     * Render admin page.
     */
    public function render_admin_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $tab = isset( $_GET['tab'] ) ? sanitize_key( $_GET['tab'] ) : 'settings';
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            <nav class="nav-tab-wrapper">
                <a class="nav-tab <?php echo 'settings' === $tab ? 'nav-tab-active' : ''; ?>"
                   href="<?php echo esc_url( admin_url( 'admin.php?page=discord-webchat&tab=settings' ) ); ?>">
                    <?php esc_html_e( 'Settings', 'discord-webchat' ); ?>
                </a>
                <a class="nav-tab <?php echo 'dashboard' === $tab ? 'nav-tab-active' : ''; ?>"
                   href="<?php echo esc_url( admin_url( 'admin.php?page=discord-webchat&tab=dashboard' ) ); ?>">
                    <?php esc_html_e( 'Dashboard', 'discord-webchat' ); ?>
                </a>
            </nav>
            <div class="tab-content" style="margin-top: 20px;">
                <?php
                if ( 'dashboard' === $tab ) {
                    $this->render_dashboard();
                } else {
                    $this->render_settings();
                }
                ?>
            </div>
        </div>
        <?php
    }

    /**
     * Render settings tab.
     */
    private function render_settings() {
        $opts = get_option( self::OPTION_NAME, array() );
        ?>
        <form method="post" action="options.php">
            <?php
            settings_fields( 'discord_webchat' );
            ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="gateway_baseurl"><?php esc_html_e( 'Gateway Base URL', 'discord-webchat' ); ?></label>
                    </th>
                    <td>
                        <input type="url"
                               id="gateway_baseurl"
                               name="<?php echo esc_attr( self::OPTION_NAME ); ?>[gateway_baseurl]"
                               value="<?php echo esc_attr( $opts['gateway_baseurl'] ?? '' ); ?>"
                               class="regular-text"
                               placeholder="https://your-gateway.example.com">
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="admin_api_key"><?php esc_html_e( 'Admin API Key', 'discord-webchat' ); ?></label>
                    </th>
                    <td>
                        <input type="password"
                               id="admin_api_key"
                               name="<?php echo esc_attr( self::OPTION_NAME ); ?>[admin_api_key]"
                               value="<?php echo esc_attr( $opts['admin_api_key'] ?? '' ); ?>"
                               class="regular-text">
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="google_maps_api_key"><?php esc_html_e( 'Google Maps API Key', 'discord-webchat' ); ?></label>
                    </th>
                    <td>
                        <input type="text"
                               id="google_maps_api_key"
                               name="<?php echo esc_attr( self::OPTION_NAME ); ?>[google_maps_api_key]"
                               value="<?php echo esc_attr( $opts['google_maps_api_key'] ?? '' ); ?>"
                               class="regular-text">
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e( 'Widget Injection', 'discord-webchat' ); ?></th>
                    <td>
                        <label for="enable_widget">
                            <input type="checkbox"
                                   id="enable_widget"
                                   name="<?php echo esc_attr( self::OPTION_NAME ); ?>[enable_widget]"
                                   value="1"
                                   <?php checked( ! empty( $opts['enable_widget'] ) ); ?>>
                            <?php esc_html_e( 'Enable widget on all pages', 'discord-webchat' ); ?>
                        </label>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="widget_position"><?php esc_html_e( 'Widget Position', 'discord-webchat' ); ?></label>
                    </th>
                    <td>
                        <select id="widget_position" name="<?php echo esc_attr( self::OPTION_NAME ); ?>[widget_position]">
                            <option value="right" <?php selected( ( $opts['widget_position'] ?? 'right' ), 'right' ); ?>>
                                <?php esc_html_e( 'Right', 'discord-webchat' ); ?>
                            </option>
                            <option value="left" <?php selected( ( $opts['widget_position'] ?? 'right' ), 'left' ); ?>>
                                <?php esc_html_e( 'Left', 'discord-webchat' ); ?>
                            </option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="widget_label"><?php esc_html_e( 'Widget Label', 'discord-webchat' ); ?></label>
                    </th>
                    <td>
                        <input type="text"
                               id="widget_label"
                               name="<?php echo esc_attr( self::OPTION_NAME ); ?>[widget_label]"
                               value="<?php echo esc_attr( $opts['widget_label'] ?? '' ); ?>"
                               class="regular-text">
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="widget_logo_url"><?php esc_html_e( 'Widget Logo URL', 'discord-webchat' ); ?></label>
                    </th>
                    <td>
                        <input type="url"
                               id="widget_logo_url"
                               name="<?php echo esc_attr( self::OPTION_NAME ); ?>[widget_logo_url]"
                               value="<?php echo esc_attr( $opts['widget_logo_url'] ?? '' ); ?>"
                               class="regular-text">
                    </td>
                </tr>
            </table>

            <h2><?php esc_html_e( 'Widget Colors', 'discord-webchat' ); ?></h2>
            <table class="form-table" role="presentation">
                <?php
                $color_fields = array(
                    'widget_accent'         => __( 'Accent Color', 'discord-webchat' ),
                    'widget_bg'             => __( 'Background', 'discord-webchat' ),
                    'widget_panel_bg'       => __( 'Panel Background', 'discord-webchat' ),
                    'widget_text'           => __( 'Text Color', 'discord-webchat' ),
                    'widget_muted'          => __( 'Muted Color', 'discord-webchat' ),
                    'widget_bubble_visitor' => __( 'Visitor Bubble', 'discord-webchat' ),
                    'widget_bubble_agent'   => __( 'Agent Bubble', 'discord-webchat' ),
                    'widget_error'          => __( 'Error Color', 'discord-webchat' ),
                );

                foreach ( $color_fields as $field => $label ) :
                    ?>
                    <tr>
                        <th scope="row">
                            <label for="<?php echo esc_attr( $field ); ?>"><?php echo esc_html( $label ); ?></label>
                        </th>
                        <td>
                            <input type="text"
                                   id="<?php echo esc_attr( $field ); ?>"
                                   name="<?php echo esc_attr( self::OPTION_NAME ); ?>[<?php echo esc_attr( $field ); ?>]"
                                   value="<?php echo esc_attr( $opts[ $field ] ?? '' ); ?>"
                                   class="regular-text"
                                   placeholder="#000000 or rgb(0,0,0)">
                        </td>
                    </tr>
                <?php endforeach; ?>
            </table>

            <?php submit_button(); ?>
        </form>
        <?php
    }

    /**
     * Make API request to gateway.
     *
     * @param string $path API path.
     * @return array
     */
    private function api_get( $path ) {
        $base = rtrim( $this->get_option( 'gateway_baseurl' ), '/' );
        $key  = $this->get_option( 'admin_api_key' );

        if ( empty( $base ) || empty( $key ) ) {
            return array(
                'ok'    => false,
                'error' => __( 'Gateway URL and API key are required. Please configure them in Settings.', 'discord-webchat' ),
            );
        }

        $url      = $base . $path;
        $response = wp_remote_get(
            $url,
            array(
                'headers' => array( 'X-Admin-Key' => $key ),
                'timeout' => 15,
            )
        );

        if ( is_wp_error( $response ) ) {
            return array(
                'ok'    => false,
                'error' => $response->get_error_message(),
            );
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = wp_remote_retrieve_body( $response );

        if ( $code < 200 || $code >= 300 ) {
            return array(
                'ok'    => false,
                'error' => sprintf( __( 'HTTP %d error', 'discord-webchat' ), $code ),
                'raw'   => $body,
            );
        }

        $data = json_decode( $body, true );

        if ( ! is_array( $data ) || empty( $data['ok'] ) ) {
            return array(
                'ok'    => false,
                'error' => __( 'Invalid response from gateway', 'discord-webchat' ),
                'raw'   => $body,
            );
        }

        return array(
            'ok'   => true,
            'data' => $data,
        );
    }

    /**
     * Render dashboard tab.
     */
    private function render_dashboard() {
        $range = isset( $_GET['range'] ) ? sanitize_key( $_GET['range'] ) : 'all';
        if ( empty( $range ) ) {
            $range = 'all';
        }

        $resp = $this->api_get( '/api/admin/sessions?limit=200&range=' . rawurlencode( $range ) );

        if ( ! $resp['ok'] ) {
            ?>
            <div class="notice notice-error">
                <p><?php echo esc_html( $resp['error'] ); ?></p>
            </div>
            <?php
            if ( ! empty( $resp['raw'] ) ) {
                ?>
                <pre style="white-space: pre-wrap; max-height: 220px; overflow: auto; background: #f7f7f7; padding: 10px;">
                    <?php echo esc_html( $resp['raw'] ); ?>
                </pre>
                <?php
            }
            return;
        }

        $sessions = $resp['data']['sessions'] ?? array();
        $map_key  = $this->get_option( 'google_maps_api_key' );

        $ranges = array(
            'day'   => __( 'Day', 'discord-webchat' ),
            'week'  => __( 'Week', 'discord-webchat' ),
            'month' => __( 'Month', 'discord-webchat' ),
            'year'  => __( 'Year', 'discord-webchat' ),
            'all'   => __( 'All Time', 'discord-webchat' ),
        );
        ?>
        <div style="margin: 10px 0;">
            <?php foreach ( $ranges as $key => $label ) : ?>
                <a class="button <?php echo $range === $key ? 'button-primary' : ''; ?>"
                   style="margin-right: 6px;"
                   href="<?php echo esc_url( admin_url( 'admin.php?page=discord-webchat&tab=dashboard&range=' . $key ) ); ?>">
                    <?php echo esc_html( $label ); ?>
                </a>
            <?php endforeach; ?>
        </div>

        <h2><?php esc_html_e( 'Sessions', 'discord-webchat' ); ?></h2>
        <table class="widefat striped">
            <thead>
                <tr>
                    <th><?php esc_html_e( 'Session', 'discord-webchat' ); ?></th>
                    <th><?php esc_html_e( 'Mode', 'discord-webchat' ); ?></th>
                    <th><?php esc_html_e( 'Client', 'discord-webchat' ); ?></th>
                    <th><?php esc_html_e( 'Name', 'discord-webchat' ); ?></th>
                    <th><?php esc_html_e( 'Email', 'discord-webchat' ); ?></th>
                    <th><?php esc_html_e( 'Last Page', 'discord-webchat' ); ?></th>
                    <th><?php esc_html_e( 'Last Seen', 'discord-webchat' ); ?></th>
                    <th><?php esc_html_e( 'Location', 'discord-webchat' ); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php if ( empty( $sessions ) ) : ?>
                    <tr>
                        <td colspan="8"><?php esc_html_e( 'No sessions found.', 'discord-webchat' ); ?></td>
                    </tr>
                <?php else : ?>
                    <?php foreach ( $sessions as $session ) : ?>
                        <?php
                        $client = ! empty( $session['client_id'] ) ? '#' . $session['client_id'] : __( 'Guest', 'discord-webchat' );
                        $loc    = trim(
                            ( $session['geo_city'] ?? '' ) . ' ' .
                            ( $session['geo_region'] ?? '' ) . ' ' .
                            ( $session['geo_country'] ?? '' )
                        );
                        if ( empty( $loc ) ) {
                            $loc = '—';
                        }
                        ?>
                        <tr>
                            <td><code><?php echo esc_html( $session['session_uuid'] ); ?></code></td>
                            <td><?php echo esc_html( $session['mode'] ?? '' ); ?></td>
                            <td><?php echo esc_html( $client ); ?></td>
                            <td><?php echo esc_html( $session['visitor_name'] ?: '—' ); ?></td>
                            <td><?php echo esc_html( $session['visitor_email'] ?: '—' ); ?></td>
                            <td><?php echo esc_html( $session['last_page_url'] ?: '—' ); ?></td>
                            <td><?php echo esc_html( $session['last_seen_at'] ?: '—' ); ?></td>
                            <td><?php echo esc_html( $loc ); ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>

        <?php
        if ( ! empty( $map_key ) ) {
            $points = array();
            foreach ( $sessions as $session ) {
                if ( ! empty( $session['geo_lat'] ) && ! empty( $session['geo_lng'] ) ) {
                    $points[] = array(
                        'lat'   => (float) $session['geo_lat'],
                        'lng'   => (float) $session['geo_lng'],
                        'label' => $session['visitor_name'] ?: __( 'Visitor', 'discord-webchat' ),
                    );
                }
            }
            ?>
            <h2><?php esc_html_e( 'Map', 'discord-webchat' ); ?></h2>
            <div id="dwc-map" style="width: 100%; height: 420px;"></div>
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
                        document.getElementById('dwc-map').innerHTML = '<p>Failed to load Google Maps.</p>';
                        return;
                    }

                    var points = <?php echo wp_json_encode( $points ); ?>;
                    var center = points.length ? {lat: points[0].lat, lng: points[0].lng} : {lat: 20, lng: 0};
                    var map = new google.maps.Map(document.getElementById('dwc-map'), {
                        zoom: 2,
                        center: center
                    });

                    var markers = points.map(function(p) {
                        return new google.maps.Marker({
                            position: {lat: p.lat, lng: p.lng},
                            title: p.label
                        });
                    });

                    if (window.markerClusterer && markers.length) {
                        new markerClusterer.MarkerClusterer({map: map, markers: markers});
                    } else {
                        markers.forEach(function(m) { m.setMap(map); });
                    }
                });
            </script>
            <?php
        } else {
            ?>
            <p><?php esc_html_e( 'Add a Google Maps API key to enable the location map.', 'discord-webchat' ); ?></p>
            <?php
        }
    }

    /**
     * Inject widget on frontend.
     */
    public function inject_widget() {
        $opts = get_option( self::OPTION_NAME, array() );

        if ( empty( $opts['enable_widget'] ) ) {
            return;
        }

        $base = rtrim( $opts['gateway_baseurl'] ?? '', '/' );
        if ( empty( $base ) ) {
            return;
        }

        $mode = 'guest';

        $data_attrs = array(
            'data-mode' => $mode,
            'data-base' => $base,
        );

        $optional_attrs = array(
            'widget_position'       => 'data-position',
            'widget_label'          => 'data-label',
            'widget_logo_url'       => 'data-logo',
            'widget_accent'         => 'data-accent',
            'widget_bg'             => 'data-bg',
            'widget_panel_bg'       => 'data-panel-bg',
            'widget_text'           => 'data-text',
            'widget_muted'          => 'data-muted',
            'widget_bubble_visitor' => 'data-bubble-visitor',
            'widget_bubble_agent'   => 'data-bubble-agent',
            'widget_error'          => 'data-error',
        );

        foreach ( $optional_attrs as $opt_key => $attr_name ) {
            if ( ! empty( $opts[ $opt_key ] ) ) {
                $data_attrs[ $attr_name ] = $opts[ $opt_key ];
            }
        }

        $attrs_str = '';
        foreach ( $data_attrs as $name => $value ) {
            $attrs_str .= ' ' . esc_attr( $name ) . '="' . esc_attr( $value ) . '"';
        }

        printf(
            '<script src="%s" defer%s></script>',
            esc_url( $base . '/widget.js?v=' . self::VERSION ),
            $attrs_str
        );
    }
}

// Initialize the plugin.
Discord_WebChat::get_instance();
