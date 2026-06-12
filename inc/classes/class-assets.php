<?php
/**
 * Assets class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Assets
 */
class Assets {

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
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );
		add_action( 'admin_footer', array( $this, 'print_manage_versions_media_template' ) );
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_block_editor_assets' ) );
	}

	/**
	 * Print media modal template for Manage Versions.
	 *
	 * @return void
	 */
	public function print_manage_versions_media_template() {
		?>
		<script type="text/html" id="tmpl-rtgodam-manage-versions-modal">
			<div id="rtgodam-manage-versions-modal" class="rtgodam-manage-versions-modal" role="dialog" aria-modal="true" aria-labelledby="rtgodam-manage-versions-title" data-attachment-id="{{ data.attachmentId }}">
				<div class="rtgodam-manage-versions-overlay"></div>
				<div class="rtgodam-manage-versions-card">
					<div class="rtgodam-manage-versions-header">
						<h2 id="rtgodam-manage-versions-title"><?php esc_html_e( 'Manage Versions', 'godam' ); ?></h2>
						<button type="button" class="rtgodam-manage-versions-close" aria-label="<?php esc_attr_e( 'Close', 'godam' ); ?>">&times;</button>
					</div>
					<div class="rtgodam-manage-versions-body">
						<div class="rtgodam-manage-versions-toolbar">
							<div class="rtgodam-manage-versions-count"><?php esc_html_e( 'Versions', 'godam' ); ?> ({{ data.totalVersions }}/{{ data.maxVersions }})</div>
							<button type="button" class="button button-primary rtgodam-add-version" <# if ( data.isLoading ) { #>disabled<# } #>>+ <?php esc_html_e( 'Add New Version', 'godam' ); ?></button>
						</div>
						<div class="rtgodam-manage-versions-list">
							<# if ( data.isLoading ) { #>
								<div class="rtgodam-manage-versions-loading">
									<span class="spinner is-active" aria-hidden="true"></span>
									<span>{{ data.loadingMessage || '<?php echo esc_js( __( 'Loading versions...', 'godam' ) ); ?>' }}</span>
								</div>
							<# } #>
							<# if ( ! data.versions || ! data.versions.length ) { #>
								<div class="rtgodam-manage-versions-empty"><?php esc_html_e( 'No versions found.', 'godam' ); ?></div>
							<# } else { #>
								<# _.each( data.versions, function( version, index ) { #>
									<div class="rtgodam-version-row <# if ( version.isActive ) { #>is-active<# } #>">
										<div class="rtgodam-version-left">
											<div class="rtgodam-version-badge">{{ version.idUpper }}</div>
											<div class="rtgodam-version-meta">
												<div class="rtgodam-version-title-row">
													<span class="rtgodam-version-title">{{ version.name }}</span>
													<# if ( version.isDefault ) { #>
														<span class="rtgodam-version-chip rtgodam-version-chip--default"><?php esc_html_e( 'Default', 'godam' ); ?></span>
													<# } #>
													<# if ( version.isActive ) { #>
														<span class="rtgodam-version-chip rtgodam-version-chip--active"><?php esc_html_e( 'Active', 'godam' ); ?></span>
													<# } #>
												</div>
												<div class="rtgodam-version-details">
													<span class="rtgodam-version-size">
														<span>
															<svg xmlns="http://www.w3.org/2000/svg" width="11" height="15" viewBox="0 0 11 15" fill="none">
																<path d="M1.8 0C1.32261 0 0.864773 0.189642 0.527208 0.527208C0.189642 0.864773 0 1.32261 0 1.8V12.6C0 13.0774 0.189642 13.5352 0.527208 13.8728C0.864773 14.2104 1.32261 14.4 1.8 14.4H9C9.47739 14.4 9.93523 14.2104 10.2728 13.8728C10.6104 13.5352 10.8 13.0774 10.8 12.6V4.8726C10.7997 4.51468 10.6572 4.17153 10.404 3.9186L6.8814 0.3951C6.62832 0.142183 6.28519 7.63932e-05 5.9274 0H1.8ZM0.9 1.8C0.9 1.56131 0.994821 1.33239 1.1636 1.1636C1.33239 0.994821 1.56131 0.9 1.8 0.9H5.4V4.05C5.4 4.40804 5.54223 4.75142 5.79541 5.00459C6.04858 5.25777 6.39196 5.4 6.75 5.4H9.9V12.6C9.9 12.8387 9.80518 13.0676 9.6364 13.2364C9.46761 13.4052 9.2387 13.5 9 13.5H1.8C1.56131 13.5 1.33239 13.4052 1.1636 13.2364C0.994821 13.0676 0.9 12.8387 0.9 12.6V1.8ZM9.7137 4.5H6.75C6.63065 4.5 6.51619 4.45259 6.4318 4.3682C6.34741 4.28381 6.3 4.16935 6.3 4.05V1.0863L9.7137 4.5Z" fill="#777777"/>
															</svg>
														</span>
														<span>{{ version.size }}</span>
													</span>
													<span class="rtgodam-version-duration">
														<span>
															<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none">
																<path fill-rule="evenodd" clip-rule="evenodd" d="M7.95 7.12725L10.8682 10.0455L10.2323 10.6823L7.05 7.5V3H7.95V7.12725ZM7.5 15C3.35775 15 0 11.6423 0 7.5C0 3.35775 3.35775 0 7.5 0C11.6423 0 15 3.35775 15 7.5C15 11.6423 11.6423 15 7.5 15ZM7.5 14.1C9.25043 14.1 10.9292 13.4046 12.1669 12.1669C13.4046 10.9292 14.1 9.25043 14.1 7.5C14.1 5.74957 13.4046 4.07084 12.1669 2.8331C10.9292 1.59535 9.25043 0.9 7.5 0.9C5.74957 0.9 4.07084 1.59535 2.8331 2.8331C1.59535 4.07084 0.9 5.74957 0.9 7.5C0.9 9.25043 1.59535 10.9292 2.8331 12.1669C4.07084 13.4046 5.74957 14.1 7.5 14.1Z" fill="#777777"/>
															</svg>
														</span>
														<span>{{ version.duration }}</span>
													</span>
													<span class="rtgodam-version-date">{{ version.date }}</span>
												</div>
											</div>
										</div>
										<div class="rtgodam-version-right">
											<# if ( ! version.isActive ) { #>
												<button type="button" class="button button-secondary rtgodam-version-action" data-version-number="{{ version.versionNumber }}"><?php esc_html_e( 'Set Active', 'godam' ); ?></button>
												<# if ( index !== 0 ) { #>
													<?php // phpcs:ignore WordPressVIPMinimum.Security.Mustache.OutputNotation ?>
													<button type="button" class="rtgodam-version-delete" aria-label="<?php esc_attr_e( 'Delete Version', 'godam' ); ?>">{{{ data.trashIcon }}}</button>
												<# } #>
											<# } #>
										</div>
									</div>
								<# } ); #>
							<# } #>
						</div>
					</div>
				</div>
			</div>
		</script>
		<?php
	}

	/**
	 * To enqueue scripts and styles.
	 *
	 * @return void
	 */
	public function enqueue_scripts() {

		wp_register_script(
			'rtgodam-script',
			RTGODAM_URL . 'assets/build/js/main.min.js',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/js/main.min.js' ),
			true
		);

		wp_register_style(
			'rtgodam-style',
			RTGODAM_URL . 'assets/build/css/main.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/main.css' )
		);

		wp_enqueue_script(
			'analytics-library',
			RTGODAM_URL . 'assets/src/libs/analytics.min.js',
			array(),
			filemtime( RTGODAM_PATH . 'assets/src/libs/analytics.min.js' ),
			true
		);

		wp_localize_script(
			'rtgodam-script',
			'nonceData',
			array(
				'nonce' => wp_create_nonce( 'wp_rest' ),
			)
		);

		$localize_array = rtgodam_get_localize_array();

		wp_localize_script(
			'rtgodam-script',
			'videoAnalyticsParams',
			$localize_array
		);

		wp_localize_script(
			'rtgodam-script',
			'godamAPIKeyData',
			array(
				'validApiKey'  => rtgodam_is_api_key_valid(),
				'noVideoFound' => __( 'No video found for attachment ID', 'godam' ),
			)
		);

		include_once ABSPATH . 'wp-admin/includes/plugin.php';
		$is_gf_active       = is_plugin_active( 'gravityforms/gravityforms.php' );
		$is_wp_polls_active = is_plugin_active( 'wp-polls/wp-polls.php' );

		$is_cf7_active     = is_plugin_active( 'contact-form-7/wp-contact-form-7.php' );
		$is_wpforms_active = is_plugin_active( 'wpforms-lite/wpforms.php' ) || is_plugin_active( 'wpforms/wpforms.php' );

		$is_jetpack_active         = is_plugin_active( 'jetpack/jetpack.php' );
		$is_sure_form_active       = is_plugin_active( 'sureforms/sureforms.php' );
		$is_forminator_form_active = is_plugin_active( 'forminator/forminator.php' );
		$is_fluent_forms_active    = is_plugin_active( 'fluentform/fluentform.php' );
		$is_everest_forms_active   = is_plugin_active( 'everest-forms/everest-forms.php' );
		$is_ninja_forms_active     = is_plugin_active( 'ninja-forms/ninja-forms.php' );
		$is_met_form_active        = is_plugin_active( 'metform/metform.php' );

		$plugin_dependencies = array(
			'gravityforms' => $is_gf_active,
			'wpPolls'      => $is_wp_polls_active,
			'cf7'          => $is_cf7_active,
			'wpforms'      => $is_wpforms_active,
			'jetpack'      => $is_jetpack_active,
			'sureforms'    => $is_sure_form_active,
			'forminator'   => $is_forminator_form_active,
			'fluentForms'  => $is_fluent_forms_active,
			'everestForms' => $is_everest_forms_active,
			'ninjaForms'   => $is_ninja_forms_active,
			'metform'      => $is_met_form_active,
		);

		/**
		 * Filter the plugin dependencies data exposed to the frontend player.
		 *
		 * @param array $plugin_dependencies Associative array of plugin dependency flags.
		 */
		$plugin_dependencies = apply_filters( 'godam_plugin_dependencies', $plugin_dependencies );

		wp_localize_script(
			'rtgodam-script',
			'godamPluginDependencies',
			$plugin_dependencies
		);

		wp_localize_script(
			'rtgodam-script',
			'godamRestRoute',
			array(
				'url' => get_rest_url( get_current_blog_id() ),
			)
		);

		/**
		 * Filter the add-on settings data exposed to the frontend.
		 * Add-ons can hook into this to provide their own settings.
		 *
		 * @param array $addon_settings Add-on settings data.
		 */
		$godam_addon_settings = apply_filters( 'godam_addon_settings_data', array() );

		wp_localize_script(
			'rtgodam-script',
			'godamAddonSettings',
			$godam_addon_settings
		);

		$this->enqueue_godam_settings();

		wp_set_script_translations( 'rtgodam-script', 'godam', RTGODAM_PATH . 'languages' );
		wp_enqueue_script( 'rtgodam-script' );
		wp_enqueue_style( 'rtgodam-style' );
	}

	/**
	 * To enqueue scripts and styles. in admin.
	 *
	 * @return void
	 */
	public function admin_enqueue_scripts() {
		$screen           = get_current_screen();
		$is_upload_screen = ( $screen && 'upload' === $screen->id );

		// Ensure WordPress media modal assets are available on admin pages where we open wp.media.
		if ( function_exists( 'wp_enqueue_media' ) ) {
			wp_enqueue_media();
		}

		wp_register_script(
			'rtgodam-script',
			RTGODAM_URL . 'assets/build/js/admin.min.js',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/js/admin.min.js' ),
			true
		);

		wp_localize_script(
			'rtgodam-script',
			'pluginInfo',
			array(
				'version'     => RTGODAM_VERSION,
				'adminUrl'    => admin_url(),
				'uploadUrl'   => wp_upload_dir()['baseurl'],
				'validApiKey' => rtgodam_is_api_key_valid(),
			)
		);

		wp_localize_script(
			'rtgodam-script',
			'godamRestRoute',
			array(
				'url'      => get_rest_url( get_current_blog_id() ),
				'homeUrl'  => get_home_url( get_current_blog_id() ),
				'adminUrl' => admin_url(),
				'nonce'    => wp_create_nonce( 'wp_rest' ),
				'apiBase'  => RTGODAM_API_BASE,
			)
		);

		wp_register_style(
			'rtgodam-style',
			RTGODAM_URL . 'assets/build/css/admin.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/admin.css' )
		);

		$this->enqueue_godam_settings();

		wp_enqueue_script( 'rtgodam-script' );
		wp_enqueue_style( 'rtgodam-style' );

		$media_library_asset_path            = RTGODAM_PATH . 'assets/build/js/media-library.min.asset.php';
		$easydam_media_library_script_assets = file_exists( $media_library_asset_path )
			? include $media_library_asset_path
			: array(
				'dependencies' => array(),
				'version'      => RTGODAM_VERSION,
			);

		wp_register_script(
			'easydam-media-library',
			RTGODAM_URL . 'assets/build/js/media-library.min.js',
			$easydam_media_library_script_assets['dependencies'],
			$easydam_media_library_script_assets['version'],
			true
		);

		wp_register_style(
			'easydam-media-library',
			RTGODAM_URL . 'assets/build/css/media-library.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/media-library.css' )
		);

		// The folder-organization toggle is GoDAM's media-library integration kill-switch.
		// When off (additive mode), the WP media-library takeover is gated in JS; the bundle
		// still loads so the GoDAM media-modal tab survives.
		$enable_folder_organization = rtgodam_is_media_library_ui_enabled();
		$folder_terms               = array();

		// Folder taxonomy terms power the folder filter UI only; skip the query when suppressed.
		if ( $enable_folder_organization ) {
			$folder_terms = get_terms(
				array(
					'taxonomy'   => 'media-folder',
					'hide_empty' => false,
				)
			);
		}

		wp_localize_script(
			'easydam-media-library',
			'MediaLibraryTaxonomyFilterData',
			array(
				'terms' => $folder_terms,
			)
		);

		wp_localize_script(
			'easydam-media-library',
			'godamTabCallback',
			array(
				'apiUrl'      => rest_url( 'godam/v1/media-library/get-godam-cmm-files' ),
				'nonce'       => wp_create_nonce( 'wp_rest' ),
				'validAPIKey' => rtgodam_is_api_key_valid(),
			)
		);

		wp_localize_script(
			'easydam-media-library',
			'transcoderSettings',
			array(
				'restUrl' => esc_url_raw( rest_url( 'godam/v1/transcoding/transcoding-status' ) ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
			)
		);

		$current_user_id = get_current_user_id();

		$easydam_media_library_data = array(
			'ajaxUrl'                  => admin_url( 'admin-ajax.php' ),
			'nonce'                    => wp_create_nonce( 'easydam_media_library' ),
			'godamToolsNonce'          => wp_create_nonce( 'rtgodam_tools' ),
			'enableFolderOrganization' => $enable_folder_organization,
			'isPollPluginActive'       => is_plugin_active( 'wp-polls/wp-polls.php' ),
			'page'                     => $screen ? $screen->id : '',
			'userId'                   => $current_user_id,
			'canEditOthersMedia'       => current_user_can( 'edit_others_posts' ),
			'canManageOptions'         => current_user_can( 'manage_options' ),
			'canEditPages'             => current_user_can( 'edit_pages' ),
		);

		/** This filter is documented in inc/classes/class-pages.php */
		$easydam_media_library_data = apply_filters( 'godam_easydam_media_library_data', $easydam_media_library_data );

		wp_localize_script(
			'easydam-media-library',
			'easydamMediaLibrary',
			$easydam_media_library_data
		);

		if ( $is_upload_screen ) {
			wp_enqueue_style( 'easydam-media-library' );
		}

		wp_set_script_translations( 'easydam-media-library', 'godam', RTGODAM_PATH . 'languages' );
		wp_enqueue_script( 'easydam-media-library' );

		/**
		 * Dependency library for the date range picker. Its only consumers (the media-library
		 * date-range filters) are suppressed in additive mode, so skip the payload when disabled.
		 */
		if ( $enable_folder_organization ) {
			wp_enqueue_script( 'moment-js', RTGODAM_URL . 'assets/src/libs/moment-js.min.js', array(), filemtime( RTGODAM_PATH . 'assets/src/libs/moment-js.min.js' ), true );
			wp_enqueue_script( 'daterangepicker-js', RTGODAM_URL . 'assets/src/libs/daterangepicker.min.js', array( 'moment-js' ), filemtime( RTGODAM_PATH . 'assets/src/libs/daterangepicker.min.js' ), true );
			wp_enqueue_style( 'daterangepicker-css', RTGODAM_URL . 'assets/src/libs/daterangepicker.css', array(), filemtime( RTGODAM_PATH . 'assets/src/libs/daterangepicker.css' ) );
		}

		// Only enqueue HTTP auth detector on uploads page or pages where media uploading is possible.
		if ( godam_should_load_auth_detector_script( $screen ) ) {
			wp_register_script(
				'godam-http-auth-detector',
				RTGODAM_URL . 'assets/build/js/http-auth-detector.min.js',
				array( 'jquery' ),
				filemtime( RTGODAM_PATH . 'assets/build/js/http-auth-detector.min.js' ),
				true
			);

			wp_localize_script(
				'godam-http-auth-detector',
				'godamHttpAuthDetector',
				array(
					'testUrl' => home_url( '/' ),
					'ajaxUrl' => admin_url( 'admin-ajax.php' ),
					'nonce'   => wp_create_nonce( 'godam-http-auth-detector' ),
				)
			);

			wp_enqueue_script( 'godam-http-auth-detector' );
		}
	}

	/**
	 * Enqueue block editor assets.
	 *
	 * @since 1.5.0
	 *
	 * @return void
	 */
	public function enqueue_block_editor_assets() {
		$block_extensions_asset_file = RTGODAM_PATH . 'assets/build/js/block-extensions.min.asset.php';

		// Default dependencies if asset file doesn't exist yet.
		$block_extensions_asset = array(
			'dependencies' => array(
				'wp-blocks',
				'wp-element',
				'wp-hooks',
				'wp-compose',
			),
			'version'      => RTGODAM_VERSION,
		);

		// Check if asset file exists (generated by @wordpress/scripts).
		if ( file_exists( $block_extensions_asset_file ) ) {
			$block_extensions_asset = include $block_extensions_asset_file;
		}

		wp_enqueue_script(
			'godam-block-extensions',
			RTGODAM_URL . 'assets/build/js/block-extensions.min.js',
			$block_extensions_asset['dependencies'],
			$block_extensions_asset['version'],
			true
		);
	}

	/**
	 * Enqueue GoDAM Settings JS localization.
	 *
	 * @return void
	 */
	private function enqueue_godam_settings() {
		$godam_settings = get_option( 'rtgodam-settings' );

		$brand_image                    = $godam_settings['video_player']['brand_image'] ?? '';
		$brand_color                    = $godam_settings['video_player']['brand_color'] ?? '';
		$enable_gtm_tracking            = $godam_settings['general']['enable_gtm_tracking'] ?? false;
		$engagement_feature_enabled     = rtgodam_is_engagement_feature_enabled();
		$enable_global_video_engagement = $godam_settings['video']['enable_global_video_engagement'] ?? true;
		$enable_global_share            = $godam_settings['video']['enable_global_video_share'] ?? true;

		$godam_settings_obj = array(

			'brandImage'                  => $brand_image,
			'brandColor'                  => $brand_color,
			'apiBase'                     => RTGODAM_API_BASE,
			'enableGTMTracking'           => $enable_gtm_tracking,
			'videoPostSettings'           => get_option( 'rtgodam_video_post_settings', array() ),
			'engagementFeatureEnabled'    => $engagement_feature_enabled,
			'enableGlobalVideoEngagement' => $engagement_feature_enabled ? $enable_global_video_engagement : false,
			'enableGlobalVideoShare'      => $enable_global_share,

			// Media-library UI kill-switch: effective value + whether it's locked from code (constant/filter).
			'mediaLibraryUIEffective'     => rtgodam_is_media_library_ui_enabled(),
			'mediaLibraryUICodeManaged'   => rtgodam_is_media_library_ui_code_managed(),

		);

		$timezone     = wp_timezone();
		$current_time = new \DateTime( 'now', $timezone );
		$end_time     = new \DateTime( '2026-01-20 23:59:59', $timezone );

		$godam_settings_obj['showOfferBanner']      = ( $current_time <= $end_time ) && ( '0' !== get_option( 'rtgodam-offer-banner', '1' ) );
		$godam_settings_obj['showOfferBannerNonce'] = wp_create_nonce( 'godam-dismiss-offer-banner-nonce' );

		if ( ! rtgodam_is_api_key_valid() ) {
			$godam_settings_obj['enableGlobalVideoEngagement'] = false;
		}

		wp_localize_script(
			'rtgodam-script',
			'godamSettings',
			$godam_settings_obj,
		);
	}
}
