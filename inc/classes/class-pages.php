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

		wp_enqueue_script(
			'block-analytics-script',
			RT_TRANSCODER_URL . 'assets/build/blocks/easydam-player/analytics.js',
			array( 'wp-element' ),
			filemtime( RT_TRANSCODER_PATH . 'assets/build/blocks/easydam-player/analytics.js' ),
			true
		);

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
			__( 'EasyDAM', 'transcoder' ),
			__( 'EasyDAM', 'transcoder' ),
			'manage_options',
			'easydam',
			array( $this, 'render_easydam_page' ),
			'dashicons-admin-generic',
			6
		);

		add_submenu_page(
			'easydam',
			__( 'Video editor', 'transcoder' ),
			__( 'Video editor', 'transcoder' ),
			'edit_posts',
			'video_editor',
			array( $this, 'render_video_editor_page' )
		);

		add_submenu_page(
			'easydam',
			__( 'Analytics', 'transcoder' ),
			__( 'Analytics', 'transcoder' ),
			'edit_posts',
			'analytics',
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
		if ( $screen && in_array( $screen->id, array( 'toplevel_page_easydam', 'easydam_page_video_editor', 'easydam_page_analytics' ) ) ) {
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
	 * To render the easydam page.
	 *
	 * @return void
	 */
	public function render_easydam_page() {
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
		<div id="root-analytics">
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
	 * To enqueue scripts and styles. in admin.
	 *
	 * @param string $hook_suffix Admin page name.
	 *
	 * @return void
	 */
	public function admin_enqueue_scripts() {
		$screen = get_current_screen();

		if ( $screen && in_array( $screen->id, array( 'toplevel_page_easydam', 'easydam_page_video_editor', 'easydam_page_analytics' ), true ) ) {
			wp_register_style(
				'transcoder-page-style-easydam',
				RT_TRANSCODER_URL . '/pages/build/style.css',
				array( 'wp-components' ),
				filemtime( RT_TRANSCODER_PATH . '/pages/build/style.css' )
			);

			wp_enqueue_style( 'transcoder-page-style-easydam' );
			wp_enqueue_media();
		}

		// Check if this is your custom admin page.
		if ( $screen && 'easydam_page_video_editor' === $screen->id ) {

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
		} elseif ( $screen && 'toplevel_page_easydam' === $screen->id ) {
			wp_register_script(
				'transcoder-page-script-easydam',
				RT_TRANSCODER_URL . '/pages/build/easydam.js',
				array( 'wp-element' ),
				filemtime( RT_TRANSCODER_PATH . '/pages/build/easydam.js' ),
				true
			);

			wp_enqueue_script( 'transcoder-page-script-easydam' );
		} elseif ( $screen && 'easydam_page_components' === $screen->id ) {
			wp_register_script(
				'transcoder-page-script-wp-components',
				RT_TRANSCODER_URL . '/pages/build/wp-components.js',
				array( 'wp-element' ),
				filemtime( RT_TRANSCODER_PATH . '/pages/build/wp-components.js' ),
				true
			);

			wp_enqueue_script( 'transcoder-page-script-wp-components' );
		} elseif ( $screen && 'easydam_page_analytics' === $screen->id ) {
			wp_register_script(
				'transcoder-page-script-analytics',
				RT_TRANSCODER_URL . 'pages/build/analytics.js',
				array( 'wp-element' ),
				filemtime( RT_TRANSCODER_PATH . 'pages/build/analytics.js' ),
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
