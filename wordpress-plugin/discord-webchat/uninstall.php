<?php
/**
 * Discord WebChat Uninstall
 *
 * Fired when the plugin is deleted.
 *
 * @package Discord_WebChat
 */

// Exit if not called by WordPress.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

// Delete plugin options.
delete_option( 'discord_webchat_options' );

// Clean up any transients.
delete_transient( 'discord_webchat_sessions_cache' );
