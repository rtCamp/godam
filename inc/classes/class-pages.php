<?php
/**
 * Assets class.
 *
 * @package react-pages-features
 */

namespace Transcoder\Inc;

use Transcoder\Inc\Traits\Singleton;

/**
 * Class Assets
 */
class Pages {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * To setup action/filter.
	 *
	 * @return void
	 */
	protected function setup_hooks() {

		/**
		 * Action
		 */
		add_action( 'admin_menu', [ $this, 'add_admin_pages' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'admin_enqueue_scripts' ] );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_scripts' ] );
		add_action( 'admin_head', [ $this, 'handle_admin_head' ] );
	}

	/**
	 * To add admin pages.
	 *
	 * @return void
	 */
	public function add_admin_pages() {
        add_menu_page(
            __( 'EasyDAM', 'react-pages-features' ),
            __( 'EasyDAM', 'react-pages-features' ),
            'manage_options',
            'easydam',
            [ $this, 'render_easydam_page' ],
            'dashicons-admin-generic',
            6
        );

		add_submenu_page(
			'easydam',
            __( 'Video editor', 'react-pages-features' ),
            __( 'Video editor', 'react-pages-features' ),
            'edit_posts',
            'video_editor',
            [ $this, 'render_video_editor_page' ]
        );
    }

	public function handle_admin_head() {
		 // Get the current screen object.
		 $screen = get_current_screen();
		
		 // Check if this is your custom admin page.
		 if ($screen && $screen->id === 'easydam_page_video_editor') {
			// Remove admin notices
			remove_all_actions('admin_notices');
			remove_all_actions('all_admin_notices');

			// Remove "Thank you for creating with WordPress" text
			add_filter('admin_footer_text', '__return_empty_string');

			// Remove the WordPress version number
			add_filter('update_footer', '__return_empty_string', 11);
		}
	}

	/**
	 * To render the easydam page.
	 * 
	 * @return void
	 */
    public function render_easydam_page() {
        ?>
        <div id="root-easydam">easydam root</div>
        <?php
    }

    public function render_components_page() {
        ?>
        <div id="root-components">components root</div>
        <?php
    }

	/**
	 * To render the video-editor page.
	 * 
	 * @return void
	 */
	public function render_video_editor_page() {
		// Check if the attachment_id is set.
		$attachment_id = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0;
		if ( empty( $attachment_id ) ) {
			wp_die( 'Invalid URL! please check that you are trying to edit correct media.' );
		}

		// Check if the attachment is video.
		$attachment = get_post( $attachment_id );
		if ( 'video' !== substr( $attachment->post_mime_type, 0, 5 ) ) {
			wp_die( 'Invalid URL! please check that you are trying to edit correct media.' );
		}

		?>
		<div id="root-video-editor">video editor root</div>
		<?php
	}

	/**
	 * To enqueue scripts and styles. in admin.
	 *
	 * @param string $hook_suffix Admin page name.
	 *
	 * @return void
	 */
	public function admin_enqueue_scripts( $hook_suffix ) {
		$screen = get_current_screen();
        
        if ( $screen && in_array( $screen->id, [ 'toplevel_page_easydam', 'easydam_page_video_editor' ] ) ) {
            wp_register_style(
            	'react-pages-features-page-style-easydam',
            	RT_TRANSCODER_URL . '/pages/build/style.css',
            	[],
            	filemtime( RT_TRANSCODER_PATH . '/pages/build/style.css' )
            );
    
            wp_enqueue_style( 'react-pages-features-page-style-easydam' );
        }

		// Check if this is your custom admin page
		if ($screen && $screen->id === 'easydam_page_video_editor') { // Replace with your page slug

			wp_register_script(
				'react-pages-features-page-script-video-editor',
				RT_TRANSCODER_URL . '/pages/build/video-editor.js',
				[ 'wp-element' ],
				filemtime( RT_TRANSCODER_PATH . '/pages/build/video-editor.js' ),
				true
			);

			// Pass dynamic data to React using wp_localize_script
			wp_localize_script(
				'react-pages-features-page-script-video-editor',
				'videoData',
				[
					'nonce'            => wp_create_nonce( 'wp_rest' ),     // WordPress nonce for API requests
					'currentUserId'    => get_current_user_id(),            // Current user ID
					'currentUserRoles' => wp_get_current_user()->roles,     // Current user roles
				]
			);

			wp_enqueue_script( 'react-pages-features-page-script-video-editor' );

		} else if ( $screen && $screen->id === 'toplevel_page_easydam' ) {
			wp_register_script(
				'react-pages-features-page-script-easydam',
				RT_TRANSCODER_URL . '/pages/build/easydam.js',
				[ 'wp-element' ],
				filemtime( RT_TRANSCODER_PATH . '/pages/build/easydam.js' ),
				true
			);

			wp_enqueue_script( 'react-pages-features-page-script-easydam' );
		} else if ( $screen && $screen->id === 'easydam_page_components' ) {
            wp_register_script(
                'react-pages-features-page-script-wp-components',
                RT_TRANSCODER_URL . '/pages/build/wp-components.js',
                [ 'wp-element' ],
                filemtime( RT_TRANSCODER_PATH . '/pages/build/wp-components.js' ),
                true
            );

            wp_enqueue_script( 'react-pages-features-page-script-wp-components' );
        }
		
	}
}
