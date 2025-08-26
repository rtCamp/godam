<?php
/**
 * AI Video Generator for WooCommerce Products
 *
 * @package GoDAM
 * @since 1.3.4
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class RT_Godam_AI_Video_Generator
 *
 * Handles AI video generation for WooCommerce products
 */
class RT_Godam_AI_Video_Generator {

	/**
	 * Constructor
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'init' ) );
	}

	/**
	 * Initialize the class
	 */
	public function init() {
		// Only load for WooCommerce product pages
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		add_action( 'add_meta_boxes', array( $this, 'add_ai_video_meta_box' ) );
		add_action( 'wp_ajax_godam_generate_ai_video', array( $this, 'ajax_generate_ai_video' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
	}

	/**
	 * Add AI video generation meta box to product edit page
	 */
	public function add_ai_video_meta_box() {
		add_meta_box(
			'godam-ai-video-generator',
			__( 'AI Video Generation', 'godam' ),
			array( $this, 'render_ai_video_meta_box' ),
			'product',
			'side',
			'default'
		);
	}

	/**
	 * Render the AI video meta box
	 *
	 * @param WP_Post $post The current post object.
	 */
	public function render_ai_video_meta_box( $post ) {
		// Get current settings
		$settings = get_option( 'rtgodam-settings', array() );
		$ai_settings = isset( $settings['ai_video'] ) ? $settings['ai_video'] : array();
		$api_key = isset( $ai_settings['api_key'] ) ? $ai_settings['api_key'] : '';
		$model = isset( $ai_settings['model'] ) ? $ai_settings['model'] : 'kling-1.5';

		// Check if API key is configured
		if ( empty( $api_key ) ) {
			echo '<div class="notice notice-warning inline">';
			echo '<p>' . sprintf(
				__( 'Please configure your Vyro AI API key in the %s.', 'godam' ),
				'<a href="' . admin_url( 'admin.php?page=godam-transcoder#ai-video-settings' ) . '">' . __( 'GoDAM settings', 'godam' ) . '</a>'
			) . '</p>';
			echo '</div>';
			return;
		}

		wp_nonce_field( 'godam_ai_video_nonce', 'godam_ai_video_nonce' );

		// Get product gallery images
		$product = wc_get_product( $post->ID );
		$gallery_ids = $product ? $product->get_gallery_image_ids() : array();
		$featured_image_id = $product ? $product->get_image_id() : 0;

		// Combine featured image with gallery
		$all_images = array();
		if ( $featured_image_id ) {
			$all_images[] = $featured_image_id;
		}
		$all_images = array_merge( $all_images, $gallery_ids );

		if ( empty( $all_images ) ) {
			echo '<div class="notice notice-info inline">';
			echo '<p>' . __( 'Please add images to the product gallery first.', 'godam' ) . '</p>';
			echo '</div>';
			return;
		}

		?>
		<div id="godam-ai-video-generator">
			<div class="godam-ai-video-section">
				<h4><?php _e( 'Select Images', 'godam' ); ?></h4>
				<div class="godam-image-selection">
					<?php foreach ( $all_images as $image_id ) : ?>
						<?php
						$image_url = wp_get_attachment_image_url( $image_id, 'thumbnail' );
						$image_alt = get_post_meta( $image_id, '_wp_attachment_image_alt', true );
						?>
						<label class="godam-image-item">
							<input type="checkbox" name="selected_images[]" value="<?php echo esc_attr( $image_id ); ?>" />
							<img src="<?php echo esc_url( $image_url ); ?>" alt="<?php echo esc_attr( $image_alt ); ?>" />
						</label>
					<?php endforeach; ?>
				</div>
			</div>

			<div class="godam-ai-video-section">
				<h4><?php _e( 'Video Prompt', 'godam' ); ?></h4>
				<textarea 
					id="godam-video-prompt" 
					name="video_prompt" 
					rows="4" 
					placeholder="<?php esc_attr_e( 'Describe the video you want to generate...', 'godam' ); ?>"
				></textarea>
				<p class="description">
					<?php _e( 'Be specific about the action, style, and mood you want in the video.', 'godam' ); ?>
				</p>
			</div>

			<div class="godam-ai-video-section">
				<button type="button" id="godam-generate-video-btn" class="button button-primary">
					<?php _e( 'Generate AI Video', 'godam' ); ?>
				</button>
				<span class="spinner" id="godam-video-spinner"></span>
			</div>

			<div id="godam-video-result">
				<h4><?php _e( 'Generated Video', 'godam' ); ?></h4>
				<div id="godam-video-content"></div>
			</div>

			<div id="godam-video-error" class="notice notice-error inline">
				<p id="godam-video-error-message"></p>
			</div>
		</div>
		<?php
	}

	/**
	 * Enqueue scripts for the AI video generator
	 *
	 * @param string $hook The current admin page hook.
	 */
	public function enqueue_scripts( $hook ) {
		global $post;

		// Only load on product edit pages
		if ( $hook !== 'post.php' && $hook !== 'post-new.php' ) {
			return;
		}

		if ( ! $post || $post->post_type !== 'product' ) {
			return;
		}

		wp_enqueue_script(
			'godam-ai-video-generator',
			RTGODAM_URL . 'admin/js/godam-ai-video-generator.js',
			array( 'jquery' ),
			RTGODAM_VERSION,
			true
		);

		wp_enqueue_style(
			'godam-ai-video-generator',
			RTGODAM_URL . 'admin/css/godam-ai-video-generator.css',
			array(),
			RTGODAM_VERSION
		);

		wp_localize_script(
			'godam-ai-video-generator',
			'godamAiVideo',
			array(
				'ajaxurl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'godam_ai_video_nonce' ),
				'strings' => array(
					'generating'        => __( 'Generating video...', 'godam' ),
					'selectImages'      => __( 'Please select at least one image.', 'godam' ),
					'enterPrompt'       => __( 'Please enter a video prompt.', 'godam' ),
					'error'            => __( 'An error occurred while generating the video.', 'godam' ),
					'success'          => __( 'Video generated successfully!', 'godam' ),
					'processingTime'   => __( 'This may take 2-5 minutes. Please wait...', 'godam' ),
				),
			)
		);
	}

	/**
	 * Handle AJAX request for AI video generation
	 */
	public function ajax_generate_ai_video() {
		// Verify nonce
		if ( ! wp_verify_nonce( $_POST['nonce'], 'godam_ai_video_nonce' ) ) {
			wp_die( __( 'Security check failed.', 'godam' ) );
		}

		// Check user capabilities
		if ( ! current_user_can( 'edit_products' ) ) {
			wp_die( __( 'You do not have permission to perform this action.', 'godam' ) );
		}

		$product_id = intval( $_POST['product_id'] );
		$selected_images = isset( $_POST['selected_images'] ) ? array_map( 'intval', $_POST['selected_images'] ) : array();
		$prompt = sanitize_textarea_field( $_POST['prompt'] );

		// Validate inputs
		if ( empty( $selected_images ) ) {
			wp_send_json_error( __( 'Please select at least one image.', 'godam' ) );
		}

		if ( empty( $prompt ) ) {
			wp_send_json_error( __( 'Please enter a video prompt.', 'godam' ) );
		}

		// Get settings
		$settings = get_option( 'rtgodam-settings', array() );
		$ai_settings = isset( $settings['ai_video'] ) ? $settings['ai_video'] : array();
		$api_key = isset( $ai_settings['api_key'] ) ? $ai_settings['api_key'] : '';
		$model = isset( $ai_settings['model'] ) ? $ai_settings['model'] : 'kling-1.5';

		if ( empty( $api_key ) ) {
			wp_send_json_error( __( 'API key is not configured.', 'godam' ) );
		}

		// Generate video
		$result = $this->generate_video_with_vyro_ai( $selected_images, $prompt, $api_key, $model );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( $result->get_error_message() );
		}

		wp_send_json_success( $result );
	}

	/**
	 * Generate video using Vyro AI API
	 *
	 * @param array  $image_ids Array of image attachment IDs.
	 * @param string $prompt    Video generation prompt.
	 * @param string $api_key   Vyro AI API key.
	 * @param string $model     AI model to use.
	 * @return array|WP_Error   Video data or error.
	 */
	private function generate_video_with_vyro_ai( $image_ids, $prompt, $api_key, $model ) {
		// Get image URLs
		$image_urls = array();
		foreach ( $image_ids as $image_id ) {
			$image_url = wp_get_attachment_url( $image_id );
			if ( $image_url ) {
				$image_urls[] = $image_url;
			}
		}

		if ( empty( $image_urls ) ) {
			return new WP_Error( 'no_images', __( 'No valid images found.', 'godam' ) );
		}

		// Prepare API request
		$api_url = 'https://api.vyro.ai/v1/imagine/api/generations';
		
		$body = array(
			'model_name' => $model,
			'prompt'     => $prompt,
			'image_url'  => $image_urls[0], // Use the first selected image
		);

		$args = array(
			'method'  => 'POST',
			'timeout' => 300, // 5 minutes timeout for video generation
			'headers' => array(
				'Authorization' => 'Bearer ' . $api_key,
				'Content-Type'  => 'application/json',
			),
			'body'    => wp_json_encode( $body ),
		);

		$response = wp_remote_request( $api_url, $args );

		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'api_error', __( 'Failed to connect to Vyro AI API.', 'godam' ) );
		}

		$response_code = wp_remote_retrieve_response_code( $response );
		$response_body = wp_remote_retrieve_body( $response );

		if ( $response_code !== 200 ) {
			$error_message = __( 'API request failed.', 'godam' );
			
			$decoded = json_decode( $response_body, true );
			if ( $decoded && isset( $decoded['error'] ) ) {
				$error_message = $decoded['error'];
			}

			return new WP_Error( 'api_error', $error_message );
		}

		$data = json_decode( $response_body, true );

		if ( ! $data || ! isset( $data['data'] ) ) {
			return new WP_Error( 'invalid_response', __( 'Invalid API response.', 'godam' ) );
		}

		return array(
			'video_url'   => isset( $data['data']['video_url'] ) ? $data['data']['video_url'] : '',
			'task_id'     => isset( $data['data']['task_id'] ) ? $data['data']['task_id'] : '',
			'status'      => isset( $data['data']['status'] ) ? $data['data']['status'] : 'processing',
			'created_at'  => current_time( 'mysql' ),
		);
	}
}

// Initialize the class
new RT_Godam_AI_Video_Generator();
