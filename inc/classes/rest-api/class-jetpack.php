<?php
/**
 * Register REST API endpoints for Jetpack Forms.
 *
 * Get all Jetpack Forms and a single Jetpack Form.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class Jetpack
 */
class Jetpack extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/jetpack-forms',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_jetpack_forms' ),
						'permission_callback' => '__return_true',
						'args'                => $this->get_collection_params(),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/jetpack-form',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_jetpack_form' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(),
							array(
								'id'    => array(
									'description'       => __( 'The ID of the Jetpack Form.', 'godam' ),
									'type'              => 'string',
									'required'          => true,
									'sanitize_callback' => 'sanitize_text_field',
								),
								'theme' => array(
									'description'       => __( 'The theme to be applied to the Jetpack Form.', 'godam' ),
									'type'              => 'string',
									'required'          => false,
									'sanitize_callback' => 'sanitize_text_field',
								),
							)
						),
					),
				),
			),
		);
	}

	/**
	 * Get all Jetpack Forms.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_jetpack_forms( $request ) {
		// Check if Jetpack plugin is active.
		if ( ! class_exists( 'Jetpack' ) ) {
			return new \WP_Error( 'jetpack_not_active', __( 'Jetpack plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$posts_with_forms = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT DISTINCT p.ID, p.post_title, p.post_content 
				FROM {$wpdb->posts} p 
				WHERE p.post_status = 'publish'
				AND p.post_type IN ( 'page', 'post' )
				AND p.post_content LIKE %s",
				'%wp:jetpack/contact-form%'
			)
		);

		$jetpack_forms = array();

		foreach ( $posts_with_forms as $post ) {
			// Parse blocks to find Jetpack forms.
			$blocks        = parse_blocks( $post->post_content );
			$forms_in_post = $this->extract_jetpack_forms_from_blocks( $blocks, $post->ID, $post->post_title );

			foreach ( $forms_in_post as $form ) {
				$jetpack_forms[] = array(
					'id'         => $form['id'],
					'title'      => $form['title'],
					'post_id'    => $post->ID,
					'post_title' => $post->post_title,
				);
			}
		}

		return rest_ensure_response( $jetpack_forms );
	}

	/**
	 * Recursively extract Jetpack forms from blocks.
	 *
	 * @param array  $blocks The blocks to search.
	 * @param int    $post_id The post ID.
	 * @param string $post_title The post title.
	 * @return array Array of found forms.
	 */
	private function extract_jetpack_forms_from_blocks( $blocks, $post_id, $post_title ) {
		$forms        = array();
		$form_counter = 1;

		$this->search_blocks_for_forms( $blocks, $post_id, $post_title, $forms, $form_counter );

		return $forms;
	}

	/**
	 * Helper method to recursively search blocks for forms.
	 *
	 * @param array  $blocks The blocks to search.
	 * @param int    $post_id The post ID.
	 * @param string $post_title The post title.
	 * @param array  &$forms Reference to forms array.
	 * @param int    &$form_counter Reference to form counter.
	 */
	private function search_blocks_for_forms( $blocks, $post_id, $post_title, &$forms, &$form_counter ) {
		foreach ( $blocks as $block ) {
			// Check if this is a Jetpack contact form block.
			if ( 'jetpack/contact-form' === $block['blockName'] ) {
				// Generate a unique ID for this form.
				$form_id = $post_id . '-' . $form_counter;

				// Extract form title from attributes or generate one.
				$form_title = 'Contact Form';
				if ( isset( $block['attrs']['subject'] ) && ! empty( $block['attrs']['subject'] ) ) {
					$form_title = $block['attrs']['subject'];
				} else {
					$form_title = $post_title . ' - Form ' . $form_counter;
				}

				$forms[] = array(
					'id'      => $form_id,
					'title'   => $form_title,
					'content' => serialize_block( $block ),
					'block'   => $block,
				);

				++$form_counter;
			}

			// Recursively search in inner blocks.
			if ( ! empty( $block['innerBlocks'] ) ) {
				$this->search_blocks_for_forms( $block['innerBlocks'], $post_id, $post_title, $forms, $form_counter );
			}
		}
	}

	/**
	 * Get a single Jetpack Form.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_jetpack_form( $request ) {
		// Check if Jetpack plugin is active.
		if ( ! class_exists( 'Jetpack' ) || ! class_exists( 'Automattic\Jetpack\Forms\ContactForm\Contact_Form' ) ) {
			return new \WP_Error( 'jetpack_not_active', __( 'Jetpack plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$form_id = $request->get_param( 'id' );
		$theme   = $request->get_param( 'theme' );

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', __( 'Invalid form ID.', 'godam' ), array( 'status' => 404 ) );
		}

		// Parse the form ID to get post ID and form number.
		$form_parts = explode( '-', $form_id );
		if ( count( $form_parts ) < 2 ) {
			return new \WP_Error( 'invalid_form_id', __( 'Invalid form ID format.', 'godam' ), array( 'status' => 404 ) );
		}

		$post_id     = intval( $form_parts[0] );
		$form_number = intval( $form_parts[1] );

		// Get the post content.
		$post = get_post( $post_id );
		if ( ! $post ) {
			return new \WP_Error( 'post_not_found', __( 'Post not found.', 'godam' ), array( 'status' => 404 ) );
		}

		// Parse blocks and find the specific form.
		$blocks     = parse_blocks( $post->post_content );
		$form_block = $this->find_form_block_by_number( $blocks, $form_number );

		if ( ! $form_block ) {
			return new \WP_Error( 'form_not_found', __( 'Form not found.', 'godam' ), array( 'status' => 404 ) );
		}

		// Generate the actual form HTML using Jetpack's Contact_Form class.
		$form_content = $this->render_jetpack_form_directly( $form_block, $post_id );

		if ( ! $form_content ) {
			return new \WP_Error( 'form_render_failed', __( 'Failed to render form.', 'godam' ), array( 'status' => 500 ) );
		}

		// Apply theme class if specified.
		$theme_class = 'modern' === $theme ? 'jetpack-form-modern' : 'jetpack-form-default';

		// Wrap the form content with theme class.
		$styled_content = '<div class="' . esc_attr( $theme_class ) . '">' . $form_content . '</div>';

		return rest_ensure_response( $styled_content );
	}

	/**
	 * Find a specific form block by its number in the blocks.
	 *
	 * @param array $blocks The blocks to search.
	 * @param int   $form_number The form number to find.
	 * @return array|false The form block or false if not found.
	 */
	private function find_form_block_by_number( $blocks, $form_number ) {
		$current_form_number = 1;
		return $this->search_for_form_block_by_number( $blocks, $form_number, $current_form_number );
	}

	/**
	 * Helper method to recursively search for a form block by number.
	 *
	 * @param array $blocks The blocks to search.
	 * @param int   $target_form_number The form number to find.
	 * @param int   &$current_form_number Reference to current form counter.
	 * @return array|false The form block or false if not found.
	 */
	private function search_for_form_block_by_number( $blocks, $target_form_number, &$current_form_number ) {
		foreach ( $blocks as $block ) {
			// Check if this is a Jetpack contact form block.
			if ( 'jetpack/contact-form' === $block['blockName'] ) {
				if ( $current_form_number === $target_form_number ) {
					return $block;
				}
				++$current_form_number;
			}

			// Recursively search in inner blocks.
			if ( ! empty( $block['innerBlocks'] ) ) {
				$result = $this->search_for_form_block_by_number( $block['innerBlocks'], $target_form_number, $current_form_number );
				if ( false !== $result ) {
					return $result;
				}
			}
		}

		return false;
	}

	/**
	 * Render a Jetpack form directly using the Contact_Form class.
	 *
	 * @param array $form_block The form block data.
	 * @param int   $post_id The post ID containing the form.
	 * @return string|false The rendered form HTML or false on error.
	 */
	private function render_jetpack_form_directly( $form_block, $post_id ) {
		if ( ! class_exists( 'Automattic\Jetpack\Forms\ContactForm\Contact_Form' ) ) {
			return false;
		}

		// Store current post state.
		$target_post = get_post( $post_id );
		if ( ! $target_post ) {
			return false;
		}

		// Enable Jetpack form styling.
		\Automattic\Jetpack\Forms\ContactForm\Contact_Form::style_on();

		try {
			// Prepare form attributes.
			$form_attrs       = $form_block['attrs'] ?? array();
			$form_attrs['id'] = $post_id;

			// Process inner blocks to get form content.
			$form_content = '';
			if ( ! empty( $form_block['innerBlocks'] ) ) {
				foreach ( $form_block['innerBlocks'] as $inner_block ) {
					$form_content .= render_block( $inner_block );
				}
			}

			// Create and parse the form using Jetpack's Contact_Form class.
			$form_html = \Automattic\Jetpack\Forms\ContactForm\Contact_Form::parse( $form_attrs, $form_content );

			return $form_html;
		} catch ( \Exception $e ) {
			return false;
		}
	}

	/**
	 * Static helper method to get rendered form HTML (for use in templates).
	 *
	 * @param string $form_id The form ID.
	 * @param string $theme The theme (default or modern).
	 * @return string|false The rendered HTML or false on error.
	 */
	public static function get_rendered_form_html_static( $form_id, $theme = 'default' ) {
		// Check if Jetpack plugin is active.
		if ( ! class_exists( 'Jetpack' ) || ! class_exists( 'Automattic\Jetpack\Forms\ContactForm\Contact_Form' ) ) {
			return false;
		}

		// Parse the form ID to get post ID and form number.
		$form_parts = explode( '-', $form_id );
		if ( count( $form_parts ) < 2 ) {
			return false;
		}

		$post_id     = intval( $form_parts[0] );
		$form_number = intval( $form_parts[1] );

		// Get the post content.
		$post = get_post( $post_id );
		if ( ! $post ) {
			return false;
		}

		// Parse blocks and find the specific form.
		$blocks     = parse_blocks( $post->post_content );
		$form_block = self::find_form_block_by_number_static( $blocks, $form_number );

		if ( ! $form_block ) {
			return false;
		}

		// Generate the actual form HTML.
		$form_content = self::render_jetpack_form_directly_static( $form_block, $post_id );

		if ( ! $form_content ) {
			return false;
		}

		// Apply theme class if specified.
		$theme_class = 'modern' === $theme ? 'jetpack-form-modern' : 'jetpack-form-default';

		// Wrap the form content with theme class.
		$wrapped_content = sprintf(
			'<div class="jetpack-form-wrapper %s">%s</div>',
			esc_attr( $theme_class ),
			$form_content
		);

		return $wrapped_content;
	}

	/**
	 * Static helper method to find form block by number in blocks.
	 *
	 * @param array $blocks The blocks to search.
	 * @param int   $form_number The form number to find.
	 * @return array|false The form block or false if not found.
	 */
	private static function find_form_block_by_number_static( $blocks, $form_number ) {
		$current_form_number = 1;
		return self::search_for_form_block_by_number_static( $blocks, $form_number, $current_form_number );
	}

	/**
	 * Static helper method to recursively search for a form block by number.
	 *
	 * @param array $blocks The blocks to search.
	 * @param int   $target_form_number The form number to find.
	 * @param int   &$current_form_number Reference to current form counter.
	 * @return array|false The form block or false if not found.
	 */
	private static function search_for_form_block_by_number_static( $blocks, $target_form_number, &$current_form_number ) {
		foreach ( $blocks as $block ) {
			// Check if this is a Jetpack contact form block.
			if ( 'jetpack/contact-form' === $block['blockName'] ) {
				if ( $current_form_number === $target_form_number ) {
					return $block;
				}
				++$current_form_number;
			}

			// Recursively search in inner blocks.
			if ( ! empty( $block['innerBlocks'] ) ) {
				$result = self::search_for_form_block_by_number_static( $block['innerBlocks'], $target_form_number, $current_form_number );
				if ( false !== $result ) {
					return $result;
				}
			}
		}

		return false;
	}

	/**
	 * Static helper method to render Jetpack form directly.
	 *
	 * @param array $form_block The form block data.
	 * @param int   $post_id The post ID containing the form.
	 * @return string|false The rendered form HTML or false on error.
	 */
	private static function render_jetpack_form_directly_static( $form_block, $post_id ) {
		if ( ! class_exists( 'Automattic\Jetpack\Forms\ContactForm\Contact_Form' ) ) {
			return false;
		}

		// Store current post state.
		$target_post = get_post( $post_id );
		if ( ! $target_post ) {
			return false;
		}

		// Enable Jetpack form styling.
		\Automattic\Jetpack\Forms\ContactForm\Contact_Form::style_on();

		try {
			// Prepare form attributes.
			$form_attrs       = $form_block['attrs'] ?? array();
			$form_attrs['id'] = $post_id;

			// Process inner blocks to get form content.
			$form_content = '';
			if ( ! empty( $form_block['innerBlocks'] ) ) {
				foreach ( $form_block['innerBlocks'] as $inner_block ) {
					$form_content .= render_block( $inner_block );
				}
			}

			// Create and parse the form using Jetpack's Contact_Form class.
			$form_html = \Automattic\Jetpack\Forms\ContactForm\Contact_Form::parse( $form_attrs, $form_content );

			return $form_html;
		} catch ( \Exception $e ) {
			return false;
		}
	}
}
