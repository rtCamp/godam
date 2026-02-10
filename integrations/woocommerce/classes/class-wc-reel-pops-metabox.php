<?php
/**
 * WooCommerce Reel Pops Product Metabox.
 *
 * Adds metabox to product edit page for configuring reel pops.
 *
 * @package RTGODAM
 */

namespace RTGODAM\Inc\WooCommerce;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class WC_Reel_Pops_Metabox
 */
class WC_Reel_Pops_Metabox {

	use Singleton;

	/**
	 * Meta key for storing reel pops config.
	 *
	 * @var string
	 */
	const META_KEY = '_godam_reel_pops_config';

	/**
	 * Constructor.
	 */
	protected function __construct() {
		$this->init_hooks();
	}

	/**
	 * Initialize hooks.
	 */
	private function init_hooks() {
		add_action( 'add_meta_boxes', array( $this, 'add_metabox' ) );
		add_action( 'save_post_product', array( $this, 'save_metabox' ), 10, 2 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
		add_action( 'wp_footer', array( $this, 'render_frontend_reel_pops' ) );
	}

	/**
	 * Add metabox to product edit screen.
	 */
	public function add_metabox() {
		add_meta_box(
			'godam_reel_pops_metabox',
			__( 'GoDAM Reel Pops', 'godam' ),
			array( $this, 'render_metabox' ),
			'product',
			'normal',
			'default'
		);
	}

	/**
	 * Enqueue admin assets.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue_admin_assets( $hook ) {
		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}

		$screen = get_current_screen();
		if ( ! $screen || 'product' !== $screen->post_type ) {
			return;
		}

		wp_enqueue_media();
		wp_enqueue_script( 'jquery-ui-sortable' );

		wp_add_inline_style( 'wp-admin', '
			.godam-reel-pops-metabox { padding: 15px; }
			.godam-reel-pops-video-list { margin-top: 15px; }
			.godam-reel-pops-video-item {
				background: #f9f9f9;
				border: 1px solid #ddd;
				padding: 12px;
				margin-bottom: 10px;
				border-radius: 4px;
				cursor: move;
			}
			.godam-reel-pops-video-item-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 10px;
			}
			.godam-reel-pops-video-item-header strong { font-size: 14px; }
			.godam-reel-pops-video-item-controls { display: flex; gap: 8px; }
			.godam-reel-pops-video-item input[type="text"] { width: 100%; }
			.godam-reel-pops-settings-grid {
				display: grid;
				grid-template-columns: repeat(2, 1fr);
				gap: 15px;
				margin-top: 15px;
			}
			.godam-reel-pops-setting-item label {
				display: block;
				margin-bottom: 5px;
				font-weight: 600;
			}
			.godam-reel-pops-setting-item select,
			.godam-reel-pops-setting-item input[type="number"] {
				width: 100%;
			}
			@media (max-width: 782px) {
				.godam-reel-pops-settings-grid { grid-template-columns: 1fr; }
			}
		' );
	}

	/**
	 * Render metabox content.
	 *
	 * @param \WP_Post $post Current post object.
	 */
	public function render_metabox( $post ) {
		wp_nonce_field( 'godam_reel_pops_metabox', 'godam_reel_pops_nonce' );

		$config = get_post_meta( $post->ID, self::META_KEY, true );
		if ( ! is_array( $config ) ) {
			$config = array();
		}

		$config = wp_parse_args(
			$config,
			array(
				'enabled'           => false,
				'videos'            => array(),
				'aspectRatio'       => '9-16',
				'position'          => 'bottom-right',
				'animation'         => 'slide-up',
				'animationDuration' => 500,
				'durationSeconds'   => 5,
				'closePersistence'  => 'show_again',
				'enableAutoplay'    => true,
				'popupWidth'        => 120,
				'bottomSpacing'     => 20,
				'sideSpacing'       => 20,
			)
		);

		?>
		<div class="godam-reel-pops-metabox">
			<p>
				<label>
					<input type="checkbox" name="godam_reel_pops[enabled]" value="1" <?php checked( $config['enabled'], true ); ?> />
					<strong><?php esc_html_e( 'Enable Reel Pops for this product', 'godam' ); ?></strong>
				</label>
			</p>
			<p class="description">
				<?php esc_html_e( 'When enabled, the configured reel popup will appear on this product\'s single page. When users click the reel, they will see this product in the modal.', 'godam' ); ?>
			</p>

			<div class="godam-reel-pops-video-selection">
				<h4><?php esc_html_e( 'Videos', 'godam' ); ?></h4>
				<div class="godam-reel-pops-video-list" id="godam-reel-pops-video-list">
					<?php
					if ( ! empty( $config['videos'] ) && is_array( $config['videos'] ) ) {
						foreach ( $config['videos'] as $index => $video ) {
							$this->render_video_item( $index, $video );
						}
					}
					?>
				</div>
				<button type="button" class="button" id="godam-reel-pops-add-video">
					<?php esc_html_e( 'Add Video', 'godam' ); ?>
				</button>
			</div>

			<div class="godam-reel-pops-settings-grid">
				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_aspect_ratio"><?php esc_html_e( 'Aspect Ratio', 'godam' ); ?></label>
					<select name="godam_reel_pops[aspectRatio]" id="godam_reel_pops_aspect_ratio">
						<option value="9-16" <?php selected( $config['aspectRatio'], '9-16' ); ?>><?php esc_html_e( '9:16 (Reels/Stories)', 'godam' ); ?></option>
						<option value="16-9" <?php selected( $config['aspectRatio'], '16-9' ); ?>><?php esc_html_e( '16:9 (Landscape)', 'godam' ); ?></option>
						<option value="4-3" <?php selected( $config['aspectRatio'], '4-3' ); ?>><?php esc_html_e( '4:3 (Standard)', 'godam' ); ?></option>
					</select>
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_position"><?php esc_html_e( 'Position', 'godam' ); ?></label>
					<select name="godam_reel_pops[position]" id="godam_reel_pops_position">
						<option value="bottom-right" <?php selected( $config['position'], 'bottom-right' ); ?>><?php esc_html_e( 'Bottom Right', 'godam' ); ?></option>
						<option value="bottom-left" <?php selected( $config['position'], 'bottom-left' ); ?>><?php esc_html_e( 'Bottom Left', 'godam' ); ?></option>
					</select>
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_animation"><?php esc_html_e( 'Animation Type', 'godam' ); ?></label>
					<select name="godam_reel_pops[animation]" id="godam_reel_pops_animation">
						<option value="slide-up" <?php selected( $config['animation'], 'slide-up' ); ?>><?php esc_html_e( 'Slide Up', 'godam' ); ?></option>
						<option value="slide-left" <?php selected( $config['animation'], 'slide-left' ); ?>><?php esc_html_e( 'Slide Left', 'godam' ); ?></option>
						<option value="slide-right" <?php selected( $config['animation'], 'slide-right' ); ?>><?php esc_html_e( 'Slide Right', 'godam' ); ?></option>
						<option value="fade" <?php selected( $config['animation'], 'fade' ); ?>><?php esc_html_e( 'Fade', 'godam' ); ?></option>
						<option value="bounce" <?php selected( $config['animation'], 'bounce' ); ?>><?php esc_html_e( 'Bounce', 'godam' ); ?></option>
						<option value="scale" <?php selected( $config['animation'], 'scale' ); ?>><?php esc_html_e( 'Scale', 'godam' ); ?></option>
					</select>
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_animation_duration"><?php esc_html_e( 'Animation Duration (ms)', 'godam' ); ?></label>
					<input type="number" name="godam_reel_pops[animationDuration]" id="godam_reel_pops_animation_duration" value="<?php echo esc_attr( $config['animationDuration'] ); ?>" min="200" max="2000" step="100" />
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_duration_seconds"><?php esc_html_e( 'Duration per Video (seconds)', 'godam' ); ?></label>
					<input type="number" name="godam_reel_pops[durationSeconds]" id="godam_reel_pops_duration_seconds" value="<?php echo esc_attr( $config['durationSeconds'] ); ?>" min="1" max="30" step="1" />
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_close_persistence"><?php esc_html_e( 'After Close', 'godam' ); ?></label>
					<select name="godam_reel_pops[closePersistence]" id="godam_reel_pops_close_persistence">
						<option value="show_again" <?php selected( $config['closePersistence'], 'show_again' ); ?>><?php esc_html_e( 'Show again on page reload', 'godam' ); ?></option>
						<option value="hide_after_close" <?php selected( $config['closePersistence'], 'hide_after_close' ); ?>><?php esc_html_e( 'Stay hidden until page reload', 'godam' ); ?></option>
					</select>
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_popup_width"><?php esc_html_e( 'Popup Width (px)', 'godam' ); ?></label>
					<input type="number" name="godam_reel_pops[popupWidth]" id="godam_reel_pops_popup_width" value="<?php echo esc_attr( $config['popupWidth'] ); ?>" min="80" max="300" step="10" />
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_bottom_spacing"><?php esc_html_e( 'Bottom Spacing (px)', 'godam' ); ?></label>
					<input type="number" name="godam_reel_pops[bottomSpacing]" id="godam_reel_pops_bottom_spacing" value="<?php echo esc_attr( $config['bottomSpacing'] ); ?>" min="0" max="100" step="5" />
				</div>

				<div class="godam-reel-pops-setting-item">
					<label for="godam_reel_pops_side_spacing"><?php esc_html_e( 'Side Spacing (px)', 'godam' ); ?></label>
					<input type="number" name="godam_reel_pops[sideSpacing]" id="godam_reel_pops_side_spacing" value="<?php echo esc_attr( $config['sideSpacing'] ); ?>" min="0" max="100" step="5" />
				</div>

				<div class="godam-reel-pops-setting-item">
					<label>
						<input type="checkbox" name="godam_reel_pops[enableAutoplay]" value="1" <?php checked( $config['enableAutoplay'], true ); ?> />
						<?php esc_html_e( 'Enable Autoplay (muted)', 'godam' ); ?>
					</label>
					<p class="description"><?php esc_html_e( 'Videos will autoplay muted. Disable to show play button overlay.', 'godam' ); ?></p>
				</div>
			</div>
		</div>

		<script type="text/javascript">
		jQuery(document).ready(function($) {
			let videoIndex = <?php echo count( $config['videos'] ); ?>;

			// Make video list sortable
			$('#godam-reel-pops-video-list').sortable({
				handle: '.godam-reel-pops-video-item',
				placeholder: 'ui-state-highlight'
			});

			// Add video button
			$('#godam-reel-pops-add-video').on('click', function() {
				const template = `
					<div class="godam-reel-pops-video-item" data-index="${videoIndex}">
						<div class="godam-reel-pops-video-item-header">
							<strong><?php esc_html_e( 'Video', 'godam' ); ?> #${videoIndex + 1}</strong>
							<div class="godam-reel-pops-video-item-controls">
								<button type="button" class="button button-small godam-reel-pops-remove-video"><?php esc_html_e( 'Remove', 'godam' ); ?></button>
							</div>
						</div>
						<p>
							<button type="button" class="button godam-reel-pops-select-video" data-index="${videoIndex}">
								<?php esc_html_e( 'Select Video', 'godam' ); ?>
							</button>
							<input type="hidden" name="godam_reel_pops[videos][${videoIndex}][videoId]" class="godam-video-id" value="0" />
							<span class="godam-video-id-display"></span>
						</p>

					</div>
				`;
				$('#godam-reel-pops-video-list').append(template);
				videoIndex++;
			});

			// Remove video
			$(document).on('click', '.godam-reel-pops-remove-video', function() {
				$(this).closest('.godam-reel-pops-video-item').remove();
			});

			// Select video
			$(document).on('click', '.godam-reel-pops-select-video', function() {
				const button = $(this);
				const item = button.closest('.godam-reel-pops-video-item');
				const videoIdInput = item.find('.godam-video-id');
				const videoIdDisplay = item.find('.godam-video-id-display');

				const mediaFrame = wp.media({
					title: '<?php esc_html_e( 'Select Video', 'godam' ); ?>',
					library: { type: 'video' },
					multiple: false
				});

				mediaFrame.on('select', function() {
					const attachment = mediaFrame.state().get('selection').first().toJSON();
					videoIdInput.val(attachment.id);
					videoIdDisplay.text('<?php esc_html_e( 'Video ID:', 'godam' ); ?> ' + attachment.id);
					button.text('<?php esc_html_e( 'Change Video', 'godam' ); ?>');
				});

				mediaFrame.open();
			});
		});
		</script>
		<?php
	}

	/**
	 * Render a single video item.
	 *
	 * @param int   $index Video index.
	 * @param array $video Video data.
	 */
	private function render_video_item( $index, $video ) {
		$video = wp_parse_args(
			$video,
			array(
				'videoId'    => 0,
				'productIds' => '',
			)
		);
		?>
		<div class="godam-reel-pops-video-item" data-index="<?php echo esc_attr( $index ); ?>">
			<div class="godam-reel-pops-video-item-header">
				<strong><?php esc_html_e( 'Video', 'godam' ); ?> #<?php echo esc_html( $index + 1 ); ?></strong>
				<div class="godam-reel-pops-video-item-controls">
					<button type="button" class="button button-small godam-reel-pops-remove-video"><?php esc_html_e( 'Remove', 'godam' ); ?></button>
				</div>
			</div>
			<p>
				<button type="button" class="button godam-reel-pops-select-video" data-index="<?php echo esc_attr( $index ); ?>">
					<?php echo $video['videoId'] > 0 ? esc_html__( 'Change Video', 'godam' ) : esc_html__( 'Select Video', 'godam' ); ?>
				</button>
				<input type="hidden" name="godam_reel_pops[videos][<?php echo esc_attr( $index ); ?>][videoId]" class="godam-video-id" value="<?php echo esc_attr( $video['videoId'] ); ?>" />
				<?php if ( $video['videoId'] > 0 ) : ?>
					<span class="godam-video-id-display"><?php esc_html_e( 'Video ID:', 'godam' ); ?> <?php echo esc_html( $video['videoId'] ); ?></span>
				<?php else : ?>
					<span class="godam-video-id-display"></span>
				<?php endif; ?>
			</p>
		</div>
		<?php
	}

	/**
	 * Save metabox data.
	 *
	 * @param int      $post_id Post ID.
	 * @param \WP_Post $post Post object.
	 */
	public function save_metabox( $post_id, $post ) {
		// Verify nonce.
		if ( ! isset( $_POST['godam_reel_pops_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['godam_reel_pops_nonce'] ) ), 'godam_reel_pops_metabox' ) ) {
			return;
		}

		// Check autosave.
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}

		// Check permissions.
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		// Get and sanitize data.
		$data = isset( $_POST['godam_reel_pops'] ) ? wp_unslash( $_POST['godam_reel_pops'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized

		$config = array(
			'enabled'           => isset( $data['enabled'] ) && '1' === $data['enabled'],
			'videos'            => array(),
			'aspectRatio'       => isset( $data['aspectRatio'] ) ? sanitize_text_field( $data['aspectRatio'] ) : '9-16',
			'position'          => isset( $data['position'] ) ? sanitize_text_field( $data['position'] ) : 'bottom-right',
			'animation'         => isset( $data['animation'] ) ? sanitize_text_field( $data['animation'] ) : 'slide-up',
			'animationDuration' => isset( $data['animationDuration'] ) ? absint( $data['animationDuration'] ) : 500,
			'durationSeconds'   => isset( $data['durationSeconds'] ) ? absint( $data['durationSeconds'] ) : 5,
			'closePersistence'  => isset( $data['closePersistence'] ) ? sanitize_text_field( $data['closePersistence'] ) : 'show_again',
			'enableAutoplay'    => isset( $data['enableAutoplay'] ) && '1' === $data['enableAutoplay'],
			'popupWidth'        => isset( $data['popupWidth'] ) ? absint( $data['popupWidth'] ) : 120,
			'bottomSpacing'     => isset( $data['bottomSpacing'] ) ? absint( $data['bottomSpacing'] ) : 20,
			'sideSpacing'       => isset( $data['sideSpacing'] ) ? absint( $data['sideSpacing'] ) : 20,
		);

		// Sanitize videos.
		if ( isset( $data['videos'] ) && is_array( $data['videos'] ) ) {
			foreach ( $data['videos'] as $video ) {
				if ( isset( $video['videoId'] ) && absint( $video['videoId'] ) > 0 ) {
					$config['videos'][] = array(
						'videoId'    => absint( $video['videoId'] ),
						'productIds' => isset( $video['productIds'] ) ? sanitize_text_field( $video['productIds'] ) : '',
					);
				}
			}
		}

		// Save or delete meta.
		if ( $config['enabled'] && ! empty( $config['videos'] ) ) {
			update_post_meta( $post_id, self::META_KEY, $config );
		} else {
			delete_post_meta( $post_id, self::META_KEY );
		}
	}

	/**
	 * Render reel pops on frontend for single product pages.
	 */
	public function render_frontend_reel_pops() {
		if ( ! is_singular( 'product' ) ) {
			return;
		}

		$product_id = get_the_ID();
		$config     = get_post_meta( $product_id, self::META_KEY, true );

		if ( ! is_array( $config ) || empty( $config['enabled'] ) || empty( $config['videos'] ) ) {
			return;
		}

		// Auto-populate product IDs with current product for all videos.
		$videos = $config['videos'];
		foreach ( $videos as &$video ) {
			if ( empty( $video['productIds'] ) ) {
				$video['productIds'] = (string) $product_id;
			}
		}
		unset( $video );

		// Convert metabox config to shortcode attributes.
		$video_ids          = array();
		$product_ids_groups = array();

		foreach ( $videos as $video ) {
			$video_ids[]          = absint( $video['videoId'] );
			$product_ids_groups[] = ! empty( $video['productIds'] ) ? sanitize_text_field( $video['productIds'] ) : (string) $product_id;
		}

		// Build shortcode attributes.
		$shortcode_atts = array(
			'video_ids'          => implode( ',', $video_ids ),
			'product_ids'        => implode( '|', $product_ids_groups ),
			'aspect_ratio'       => sanitize_text_field( $config['aspectRatio'] ),
			'position'           => sanitize_text_field( $config['position'] ),
			'animation'          => sanitize_text_field( $config['animation'] ),
			'animation_duration' => absint( $config['animationDuration'] ),
			'duration_seconds'   => absint( $config['durationSeconds'] ),
			'close_persistence'  => sanitize_text_field( $config['closePersistence'] ),
			'enable_autoplay'    => $config['enableAutoplay'] ? 'true' : 'false',
			'popup_width'        => absint( $config['popupWidth'] ),
			'bottom_spacing'     => absint( $config['bottomSpacing'] ),
			'side_spacing'       => absint( $config['sideSpacing'] ),
			'block_id'           => 'godam-reel-pops-product-' . $product_id,
		);

		// Build shortcode string.
		$shortcode_parts = array();
		foreach ( $shortcode_atts as $key => $value ) {
			if ( '' !== $value ) {
				$shortcode_parts[] = sprintf( '%s="%s"', $key, esc_attr( $value ) );
			}
		}

		$shortcode = '[godam_video_reel_pops ' . implode( ' ', $shortcode_parts ) . ']';

		// Render via shortcode.
		echo do_shortcode( $shortcode ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}
