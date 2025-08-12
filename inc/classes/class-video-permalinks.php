<?php
/**
 * Permalinks settings for GoDAM Video CPT slug.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Permalinks.
 */
class Video_Permalinks {

	use Singleton;

	/**
	 * Option slug for video post settings.
	 *
	 * @since 1.3.1
	 * @var string
	 */
	const OPTION_SLUG = 'rtgodam_video_post_settings';

	/**
	 * Default video slug.
	 *
	 * @since 1.3.1
	 * @var string
	 */
	const DEFAULT_VIDEO_SLUG = 'videos';

	/**
	 * Construct method.
	 * 
	 * @return void
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		// Add a section to the permalinks page.
		add_action( 'admin_init', array( $this, 'register_permalink_settings' ) );
		
		// Add fields to the permalinks page.
		add_action( 'admin_init', array( $this, 'add_permalink_fields' ) );
		
		// Save permalink settings.
		add_action( 'admin_init', array( $this, 'save_permalink_settings' ) );
	}

	/**
	 * Register permalink settings.
	 *
	 * @return void
	 */
	public function register_permalink_settings() {
		// Combined settings for video slug and visibility options.
		register_setting(
			'permalink',
			self::OPTION_SLUG,
			array(
				'type'              => 'object',
				'description'       => __( 'GoDAM Video post settings', 'godam' ),
				'sanitize_callback' => array( $this, 'sanitize_video_post_settings' ),
				'default'           => array(
					'video_slug'    => self::DEFAULT_VIDEO_SLUG,
					'allow_archive' => false,
					'allow_single'  => false,
				),
			)
		);
	}

	/**
	 * Add permalink fields.
	 *
	 * @return void
	 */
	public function add_permalink_fields() {
		add_settings_section(
			'godam-permalink-settings',
			__( 'GoDAM Video Permalinks', 'godam' ),
			array( $this, 'permalink_settings_section' ),
			'permalink'
		);

		add_settings_field(
			'rtgodam_video_slug',
			__( 'Video archive URL slug', 'godam' ),
			array( $this, 'video_slug_field' ),
			'permalink',
			'godam-permalink-settings'
		);
		
		// Add new settings fields for visibility.
		add_settings_field(
			'rtgodam_video_post_allow_archive',
			__( 'Video archive page visibility', 'godam' ),
			array( $this, 'video_archive_visibility_field' ),
			'permalink',
			'godam-permalink-settings'
		);
		
		add_settings_field(
			'rtgodam_video_post_allow_single',
			__( 'Video single page visibility', 'godam' ),
			array( $this, 'video_single_visibility_field' ),
			'permalink',
			'godam-permalink-settings'
		);
	}

	/**
	 * Permalink settings section description.
	 *
	 * @return void
	 */
	public function permalink_settings_section() {
		echo '<p>' . esc_html__( 'These settings control the permalinks used for GoDAM video archives and pages.', 'godam' ) . '</p>';
	}

	/**
	 * Video slug field.
	 * 
	 * @return void
	 */
	public function video_slug_field() {
		$settings = get_option( self::OPTION_SLUG, array( 'video_slug' => self::DEFAULT_VIDEO_SLUG ) );

		// If video_slug key doesn't exist in currently stored settings, check old option for display.
		if ( ! isset( $settings['video_slug'] ) ) {
			$value = get_option( 'rtgodam_video_slug', self::DEFAULT_VIDEO_SLUG );
		} else {
			$value = $settings['video_slug'];
		}

		?>
		<input 
			type='text' 
			name='rtgodam_video_post_settings[video_slug]' 
			id='rtgodam_video_slug' 
			value='<?php echo esc_attr( $value ); ?>' 
			class='regular-text code'
		/>
		<p class='description'>
			<?php esc_html_e( 'This slug will be used in the URL for video archive and single video pages (e.g., yoursite.com/videos/). Only lowercase letters, numbers, hyphens, and underscores are allowed.', 'godam' ); ?>
		</p>
		<?php
	}
	
	/**
	 * Video archive visibility field.
	 *
	 * @since 1.3.1
	 * 
	 * @return void
	 */
	public function video_archive_visibility_field() {
		$settings = get_option( self::OPTION_SLUG, array( 'allow_archive' => false ) );
		$value    = isset( $settings['allow_archive'] ) ? $settings['allow_archive'] : false;
		?>
		<input 
			type='checkbox' 
			name='rtgodam_video_post_settings[allow_archive]' 
			id='rtgodam_video_post_allow_archive' 
			value='1' 
			<?php checked( $value ); ?> 
		/>
		<p class='description'>
			<?php esc_html_e( 'Enable this to allow public access to the video archive page. When disabled, the video archive page will return 404.', 'godam' ); ?>
		</p>
		<?php
	}
	
	/**
	 * Video single page visibility field.
	 * 
	 * @since 1.3.1
	 *
	 * @return void
	 */
	public function video_single_visibility_field() {
		$settings = get_option( self::OPTION_SLUG, array( 'allow_single' => false ) );
		$value    = isset( $settings['allow_single'] ) ? $settings['allow_single'] : false;
		?>
		<input 
			type='checkbox' 
			name='rtgodam_video_post_settings[allow_single]' 
			id='rtgodam_video_post_allow_single' 
			value='1' 
			<?php checked( $value ); ?> 
		/>
		<p class='description'>
			<?php esc_html_e( 'Enable this to allow public access to individual video pages. When disabled, single video pages will return 404 but videos will still be available in Query Loop blocks.', 'godam' ); ?>
		</p>
		<?php
	}
	
	/**
	 * Save permalink settings.
	 *
	 * @return void
	 */
	public function save_permalink_settings() {
		// Only process on the permalinks settings page.
		if ( ! is_admin() || ! isset( $_POST['permalink_structure'] ) ) {
			return;
		}

		// User permission check.
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Nonce verification.
		if ( isset( $_POST['permalink_structure'] ) && isset( $_POST['_wpnonce'] ) && wp_verify_nonce( sanitize_key( $_POST['_wpnonce'] ), 'update-permalink' ) ) {
			
			// Get current settings with migration fallback for video_slug.
			$current_settings = get_option( self::OPTION_SLUG, false );
			if ( false === $current_settings || ! isset( $current_settings['video_slug'] ) ) {
				$old_video_slug = get_option( 'rtgodam_video_slug', self::DEFAULT_VIDEO_SLUG );
				
				// If settings don't exist, create new array, otherwise preserve existing settings.
				if ( false === $current_settings ) {
					$current_settings = array(
						'video_slug'    => $old_video_slug,
						'allow_archive' => false,
						'allow_single'  => false,
					);
				} else {
					// Settings exist but missing video_slug, add it.
					$current_settings['video_slug'] = $old_video_slug;
				}
				
				// Delete old option since we've migrated its value.
				delete_option( 'rtgodam_video_slug' );
			}
			
			$new_settings = array();
			
			// Handle video slug.
			if ( isset( $_POST[ self::OPTION_SLUG ]['video_slug'] ) ) {
				$sanitized_slug             = sanitize_title( wp_unslash( $_POST[ self::OPTION_SLUG ]['video_slug'] ) );
				$new_settings['video_slug'] = empty( $sanitized_slug ) ? self::DEFAULT_VIDEO_SLUG : $sanitized_slug;
			} else {
				$new_settings['video_slug'] = isset( $current_settings['video_slug'] ) ? $current_settings['video_slug'] : self::DEFAULT_VIDEO_SLUG;
			}
			
			// Handle archive visibility.
			$new_settings['allow_archive'] = isset( $_POST[ self::OPTION_SLUG ]['allow_archive'] ) ? true : false;
			
			// Handle single page visibility.
			$new_settings['allow_single'] = isset( $_POST[ self::OPTION_SLUG ]['allow_single'] ) ? true : false;
			
			// Check if any settings changed.
			if ( $current_settings !== $new_settings ) {
				update_option( self::OPTION_SLUG, $new_settings );
				$should_flush = true;
			}
			
			// Flush rewrite rules if any permalink-related setting was changed.
			if ( isset( $should_flush ) && $should_flush ) {
				flush_rewrite_rules();
			}
		}
	}

	/**
	 * Sanitize video post settings.
	 * 
	 * @since 1.3.1
	 *
	 * @param array $input The input array to sanitize.
	 * 
	 * @return array The sanitized array.
	 */
	public function sanitize_video_post_settings( $input ) {
		$sanitized = array();
		
		// Sanitize video slug.
		if ( isset( $input['video_slug'] ) ) {
			$sanitized_slug          = sanitize_title( $input['video_slug'] );
			$sanitized['video_slug'] = empty( $sanitized_slug ) ? self::DEFAULT_VIDEO_SLUG : $sanitized_slug;
		} else {
			$sanitized['video_slug'] = self::DEFAULT_VIDEO_SLUG;
		}
		
		// Sanitize allow_archive setting.
		if ( isset( $input['allow_archive'] ) ) {
			$sanitized['allow_archive'] = rest_sanitize_boolean( $input['allow_archive'] );
		} else {
			$sanitized['allow_archive'] = false;
		}
		
		// Sanitize allow_single setting.
		if ( isset( $input['allow_single'] ) ) {
			$sanitized['allow_single'] = rest_sanitize_boolean( $input['allow_single'] );
		} else {
			$sanitized['allow_single'] = false;
		}
		
		return $sanitized;
	}
}
