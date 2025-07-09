<?php
/**
 * Main WPForms Integration class.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WPForms;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * WPForms Integration class.
 *
 * @since n.e.x.t
 */
class WPForms_Integration {
    use Singleton;

    /**
     * Initialize.
     *
     * @since n.e.x.t
     *
     * @return void
     */
    public function init() {
        if ( is_plugin_active( 'wpforms-lite/wpforms.php' ) || is_plugin_active( 'wpforms/wpforms.php' ) ) {
            add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_assets' ] );
            add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_frontend_assets' ] );
        }
    }

    /**
     * Enqueue assets in the admin area.
     *
     * @since n.e.x.t
     *
     * @return void
     */
    public function enqueue_admin_assets() {
        if ( isset( $_GET['page'], $_GET['id'] ) && 'rtgodam_video_editor' === $_GET['page'] ) {
            // Enqueue the WPForms styles.
            $frontend = wpforms()->obj('frontend');
            $frontend->assets_css();

            wp_enqueue_style(
                'wpforms-uppy-video-style',
                RTGODAM_URL . 'assets/build/css/wpforms-uppy-video.css',
                [],
                filemtime( RTGODAM_PATH . 'assets/build/css/wpforms-uppy-video.css' )
            );
        }
    }

    /**
     * Enqueue assets in frontend area.
     *
     * @since n.e.x.t
     *
     * @return void
     */
    public function enqueue_frontend_assets() {
        wp_enqueue_style(
            'wpforms-uppy-video-style',
            RTGODAM_URL . 'assets/build/css/wpforms-uppy-video.css',
            [],
            filemtime( RTGODAM_PATH . 'assets/build/css/wpforms-uppy-video.css' )
        );
    }
}
