<?php
/**
 * Assets class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc;

use Transcoder\Inc\Traits\Singleton;

/**
 * Class Assets
 */
class Pages {
	use Singleton;

	/**
	 * Hardcoded Slugs
	 */
	private $menu_slug = 'godam';
	private $video_editor_slug = 'video_editor';
	private $analytics_slug = 'analytics';
	private $menu_page_id = 'toplevel_page_godam';
	private $video_editor_page_id = 'godam_page_video_editor';
	private $analytics_page_id = 'godam_page_analytics';

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
		add_action( 'admin_menu', array( $this, 'add_admin_pages' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );
		add_action( 'admin_head', array( $this, 'handle_admin_head' ) );
		add_action( 'enqueue_block_assets', array( $this, 'handle_block_assets' ) );
	}

	/**
	 * To enqueue scripts and styles in block editor and frontend.
	 *
	 * @return void
	 */
	public function handle_block_assets() {

		wp_register_script(
			'block-analytics-script',
			RT_TRANSCODER_URL . 'assets/build/blocks/godam-player/analytics.js',
			array( 'wp-element' ),
			filemtime( RT_TRANSCODER_PATH . 'assets/build/blocks/godam-player/analytics.js' ),
			true
		);

		$localize_array = rt_get_localize_array();

		wp_localize_script(
			'block-analytics-script',
			'videoAnalyticsParams',
			$localize_array
		);

		
		wp_enqueue_script( 'block-analytics-script' );

		wp_localize_script(
			'block-frontend-script',
			'nonceData',
			array(
				'nonce' => wp_create_nonce( 'wp_rest' ),
			)
		);
	}

	/**
	 * To add admin pages.
	 *
	 * @return void
	 */
	public function add_admin_pages() {
		add_menu_page(
			__( 'GoDAM', 'godam' ),
			__( 'GoDAM', 'godam' ),
			'manage_options',
			$this->menu_slug,
			array( $this, 'render_godam_page' ),
			'dashicons-admin-generic',
			30
		);

		add_submenu_page(
			$this->menu_slug,
			__( 'Video editor', 'godam' ),
			__( 'Video editor', 'godam' ),
			'edit_posts',
			$this->video_editor_slug,
			array( $this, 'render_video_editor_page' )
		);

		add_submenu_page(
			$this->menu_slug,
			__( 'Analytics', 'godam' ),
			__( 'Analytics', 'godam' ),
			'edit_posts',
			$this->analytics_slug,
			array( $this, 'render_analytics_page' )
		);
	}

	/**
	 * Handle admin head to remove admin notices.
	 *
	 * @return void
	 */
	public function handle_admin_head() {
		// Get the current screen object.
		$screen = get_current_screen();

		// Check if this is your custom admin page.
		if ( $screen && in_array( $screen->id, array( $this->menu_page_id, $this->video_editor_page_id, $this->analytics_page_id ) ) ) {
			// Remove admin notices.
			remove_all_actions( 'admin_notices' );
			remove_all_actions( 'all_admin_notices' );

			// Remove "Thank you for creating with WordPress" text.
			add_filter( 'admin_footer_text', '__return_empty_string' );

			// Remove the WordPress version number.
			add_filter( 'update_footer', '__return_empty_string', 11 );
		}
	}

	/**
	 * To render the godam page.
	 *
	 * @return void
	 */
	public function render_godam_page() {
		?>
		<div id="root-easydam">
			<div class="wrap flex min-h-[80vh] gap-4 my-4">
				<!-- Sidebar Skeleton -->
				<div class="max-w-[220px] w-full rounded-lg bg-white shadow-md border border-gray-200">
					<nav class="loading-skeleton flex flex-col gap-4 p-4">
						<!-- Sidebar Tabs -->
						<div class="skeleton-container skeleton-container-short">
							<div class="skeleton-header w-3/4"></div>
						</div>
						<div class="skeleton-container skeleton-container-short">
							<div class="skeleton-header w-3/4"></div>
						</div>
						<div class="skeleton-container skeleton-container-short">
							<div class="skeleton-header w-3/4"></div>
						</div>
					</nav>
				</div>

				<!-- Main Content Skeleton -->
				<div id="main-content" class="w-full p-5 bg-white rounded-lg border">
					<!-- General Settings Form Skeleton -->
					<div class="loading-skeleton flex flex-col gap-4">
						<!-- Title -->
						<div class="skeleton-container skeleton-container-short">
							<div class="skeleton-header w-1/2"></div>
						</div>

						<!-- Input Field Skeleton -->
						<div class="skeleton-container">
							<div class="skeleton-line w-3/4"></div>
							<div class="skeleton-line short w-1/2"></div>
						</div>

						<!-- Buttons Skeleton -->
						<div class="flex gap-2">
							<div class="skeleton-button w-32 h-10"></div>
							<div class="skeleton-button w-40 h-10"></div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * To render the video-editor page.
	 *
	 * @return void
	 */
	public function render_video_editor_page() {

		?>
		<div id="root-video-editor">
			<div class="progress-bar-wrapper">
				<div class="progress-bar-container">
					<div class="progress-bar">
						<div class="progress-bar-inner"></div>
					</div>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * To render the analytics page.
	 *
	 * @return void
	 */
	public function render_analytics_page() {
		?>
		<div id="root-video-analytics"></div>
		<?php
	}

	/**
	 * To enqueue scripts and styles. in admin.
	 *
	 * @param string $hook_suffix Admin page name.
	 *
	 * @return void
	 */
	public function admin_enqueue_scripts() {
		$screen = get_current_screen();

		if ( $screen && in_array( $screen->id, array( $this->menu_page_id, $this->video_editor_page_id, $this->analytics_page_id ), true ) ) {
			wp_register_style(
				'transcoder-page-style-godam',
				RT_TRANSCODER_URL . '/pages/build/style.css',
				array( 'wp-components' ),
				filemtime( RT_TRANSCODER_PATH . '/pages/build/style.css' )
			);

			wp_enqueue_style( 'transcoder-page-style-godam' );
			wp_enqueue_media();
		}
		// Check if this is your custom admin page.
		if ( $screen && $this->video_editor_page_id === $screen->id ) {
			wp_register_script(
				'transcoder-page-script-video-editor',
				RT_TRANSCODER_URL . '/pages/build/video-editor.js',
				array( 'wp-element' ),
				filemtime( RT_TRANSCODER_PATH . '/pages/build/video-editor.js' ),
				true
			);

			// Pass dynamic data to React using wp_localize_script.
			wp_localize_script(
				'transcoder-page-script-video-editor',
				'videoData',
				array(
					'nonce'            => wp_create_nonce( 'wp_rest' ),     // WordPress nonce for API requests.
					'currentUserId'    => get_current_user_id(),            // Current user ID.
					'currentUserRoles' => wp_get_current_user()->roles,     // Current user roles.
				)
			);

			wp_enqueue_script( 'transcoder-page-script-video-editor' );
		} elseif ( $screen && $this->menu_page_id === $screen->id ) {

			wp_register_script(
				'transcoder-page-script-godam',
				RT_TRANSCODER_URL . '/pages/build/godam.js',
				array( 'wp-element' ),
				filemtime( RT_TRANSCODER_PATH . '/pages/build/godam.js' ),
				true
			);

			// Verify the user's license.
			$license_key = get_site_option( 'rt-transcoding-api-key', '' );
			$result      = rtt_verify_license( $license_key );

			$valid_license = false;
			$user_data     = [];

			if ( is_wp_error( $result ) ) {
				$valid_license = false;
			} else {
				$valid_license            = true;
				$user_data                = $result['data'] ?? [];
				$user_data['license_key'] = rtt_mask_string( $user_data['license_key'] );
			}

			wp_localize_script(
				'transcoder-page-script-godam',
				'userData',
				array(
					'currentUserId'   => get_current_user_id(), // Current user ID.
					'storage_used'    => 75,
					'total_storage'   => 100,
					'bandwidth_used'  => 98.94,
					'total_bandwidth' => 200,
					'valid_license'   => $valid_license,
					'user_data'       => $user_data,
				)
			);

			wp_enqueue_script( 'transcoder-page-script-godam' );
		} elseif ( $screen && $this->analytics_page_id === $screen->id ) {

			wp_register_script(
				'd3-js',
				'https://d3js.org/d3.v7.min.js',
				array(),
				'7.0.0',
				false
			);

			wp_register_script(
				'transcoder-page-script-analytics',
				RT_TRANSCODER_URL . 'pages/build/analytics.js',
				array( 'wp-element' ),
				filemtime( RT_TRANSCODER_PATH . 'pages/build/analytics.js' ),
				true
			);

			wp_register_script(
				'video-analytics-charts',
				RT_TRANSCODER_URL . 'assets/build/js/video-analytics.js',
				array( 'transcoder-page-script-analytics', 'd3-js' ),
				filemtime( RT_TRANSCODER_PATH . 'assets/build/js/video-analytics.js' ),
				true
			);

			// Pass dynamic data to React using wp_localize_script.
			wp_localize_script(
				'transcoder-page-script-analytics',
				'videoData',
				array(
					'nonce'            => wp_create_nonce( 'wp_rest' ),     // WordPress nonce for API requests.
					'currentUserId'    => get_current_user_id(),            // Current user ID.
					'currentUserRoles' => wp_get_current_user()->roles,     // Current user roles.
				)
			);
			wp_enqueue_script( 'transcoder-page-script-analytics' );
			wp_enqueue_script( 'd3-js' );
			wp_enqueue_script( 'video-analytics-charts' );
		}


		wp_enqueue_style( 'wp-components' );

		wp_register_script(
			'media-library-react',
			RT_TRANSCODER_URL . '/pages/build/media-library.js',
			array( 'wp-element', 'wp-i18n' ),
			filemtime( RT_TRANSCODER_PATH . '/pages/build/media-library.js' ),
			true
		);

		wp_enqueue_script( 'media-library-react' );
	}
}
