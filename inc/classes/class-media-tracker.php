<?php
/**
 * Check if Media Transcoding is functional.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

class Media_Tracker {
    use Singleton;

    /**
     * Constructor.
     */
    public function __construct() {
        $this->setup_hooks();
    }

    /**
     * Setup hooks.
     *
     * @return void
     */
    public function setup_hooks() {
        add_action( 'add_attachment', array( $this, 'track_new_attachment' ) );
        add_action( 'init', array( $this, 'check_new_attachment_transcoding_status' ) );
        add_action( 'delete_attachment', array( $this, 'delete_attachment' ) );
    }

    public function track_new_attachment( $attachment_id ) {
        $attachment_data = array(
            'attachment_id'      => $attachment_id,
            'transcoding_status' => '',
        );

        // Check if the attachment is a video.
        update_option( 'rtgodam_new_attachment', $attachment_data, '', true );
    }

    public function delete_attachment( $attachment_id ) {
        // Check if the attachment is a video.
        $attachment_data = get_option( 'rtgodam_new_attachment' );

        if ( ! empty( $attachment_data ) && $attachment_data['attachment_id'] === $attachment_id ) {
            delete_option( 'rtgodam_new_attachment' );
        }
    }

    public function check_new_attachment_transcoding_status() {
        $attachment_data = get_option( 'rtgodam_new_attachment' );

        error_log( 'New Media Transcoding status: ' . print_r( $attachment_data, true ) );

        if ( ! empty( $attachment_data ) ) {
            $attachment_id = $attachment_data['attachment_id'];

            if ( 'success' === $attachment_data['transcoding_status'] ) {
                return;
            }

            if ( 'failed' === $attachment_data['transcoding_status'] ) {
                error_log( 'Transcoding failed already!!!!!!!!' );
                $this->display_admin_notice();
                return;
            }

            $transcoding_status = $this->get_transcoding_status( $attachment_id );

            if ( 'failed' === $transcoding_status ) {
                // Display admin notice.
                $this->display_admin_notice();
            }

            $attachment_data['transcoding_status'] = $transcoding_status;
            update_option( 'rtgodam_new_attachment', $attachment_data, '', true );
        }
    }

    public function get_transcoding_status( $attachment_id ) {
        // Placeholder for actual transcoding status check.
        // This should be replaced with the actual logic to check the transcoding status.
        // return 'failed'; // or 'failed'

        $ids = array( $attachment_id );

        $base_url = get_rest_url( get_current_blog_id() );

        $url = $base_url . 'godam/v1/transcoding-status?ids[]=' . implode( ',', $ids );

        $response = wp_remote_get(
            $url,
            array(
                'timeout'     => 60,
            )
        );

        if ( is_wp_error( $response ) ) {
            return 'error';
        }

        $body = wp_remote_retrieve_body( $response );
        $data = json_decode( $body, true );


        error_log( 'New Media Transcoding status: ' . print_r( $data, true ) );

        return 'success';

    }

    public function display_admin_notice() {
        add_action( 'admin_notices', function() {
            ?>
            <div class="notice notice-error">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="color: oklch(68.1% 0.162 75.834);">
                        <svg xmlns="http://www.w3.org/2000/svg" style="width: 32px; height: 32px;" width="16" height="16" fill="currentColor" class="bi bi-exclamation-triangle-fill" viewBox="0 0 16 16">
                            <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
                        </svg>
                    </div>
                    <div>
                        <p><strong><?php esc_html_e( 'GoDAM Notice: CDN Conflict Detected!', 'godam' ); ?></strong></p>
                        <p style="font-weight: 500;"><?php echo esc_html__( "It appears that a Content Delivery Network (CDN) is active on your site, which may interfere with GoDAM's video transcoding features. If the CDN issue has been resolved, you can safely ignore this warning and proceed with video transcoding.", 'godam' ); ?></p>
                        <?php
                        $raw_html = $raw_html = __(
                            '<p>For detailed guidance, please refer to our <a href="%1$s" target="_blank">CDN Integration Guide</a> or contact our <a href="%2$s" target="_blank">Support Team</a> for assistance.</p>',
                            'godam'
                        );

                        $cdn_guide_url = esc_url( 'https://example.com/cdn-guide' );
                        $support_url   = esc_url( 'https://app.godam.io/helpdesk/my-tickets' );

                        // Allowed HTML tags for wp_kses
                        $allowed_tags = [
                            'a' => [
                                'href'   => [],
                                'target' => [],
                            ],
                            'p' => [],
                            'strong' => [],
                        ];

                        $formatted_html = sprintf( $raw_html, $cdn_guide_url, $support_url );
                        // Output safely with allowed HTML tags
                        echo wp_kses( $formatted_html, $allowed_tags );
                        ?>
                    </div>
                </div>
            </div>
            <?php
        } );
    }

}