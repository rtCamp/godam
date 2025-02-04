<?php
/**
 * Class to handle Media Folders.
 *
 * @package transcoder
 */

// phpcs:disable WordPress.Security.NonceVerification.Recommended -- Using default nonce verification so disabling for this file.

namespace Transcoder\Inc;

use Transcoder\Inc\Traits\Singleton;

/**
 * Class Media_Library
 */
class Media_Library_Ajax {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_filter( 'ajax_query_attachments_args', array( $this, 'filter_media_library_by_taxonomy' ) );
		add_action( 'pre_get_posts', array( $this, 'pre_get_post_filter' ) );

		add_action( 'restrict_manage_posts', array( $this, 'restrict_manage_media_filter' ) );

		// TODO: think about merging this hooks and other to media-filters, as they are related to media library.
		$offload_media = get_option( EasyDAM_Constants::S3_STORAGE_OPTIONS );
		$offload_media = isset( $offload_media['offLoadMedia'] ) ? $offload_media['offLoadMedia'] : false;

		$offload_media = false; // disabling the S3 bucket for now

		if ( $offload_media ) {
			add_filter( 'manage_media_columns', array( $this, 'add_media_column' ) );
			add_action( 'manage_media_custom_column', array( $this, 'media_column_value' ), 10, 2 );
			add_filter( 'wp_prepare_attachment_for_js', array( $this, 'add_media_folder_to_attachment' ), 10, 2 );
			add_filter( 'bulk_actions-upload', array( $this, 'add_bulk_actions' ) );
		}
	}

	/**
	 * Add media column.
	 *
	 * @param array $columns Columns.
	 *
	 * @return array $columns Columns.
	 */
	public function add_media_column( $columns ) {
		$columns['s3_url'] = 'S3 URL';

		return $columns;
	}

	/**
	 * Add media column value.
	 *
	 * @param string $column_name Column name.
	 * @param int    $post_id     Post ID.
	 *
	 * @return void
	 */
	public function media_column_value( $column_name, $post_id ) {

		// Check if post_id is attachment type and is an image.
		if ( 'attachment' === get_post_type( $post_id ) ) {
			$attachment = get_post( $post_id );

			if ( 'image' !== substr( $attachment->post_mime_type, 0, 5 ) ) {
				return;
			}

			if ( 's3_url' === $column_name ) {
				$s3_url = get_post_meta( $post_id, 's3_url', true );

				if ( empty( $s3_url ) ) {
					?>
						<a class="upload-to-s3" href="#" data-post-id="<?php echo esc_attr( $post_id ); ?>"><i class="dashicons dashicons-upload"></i></a>
					<?php
				} else {
					?>
						<a href="<?php echo esc_url( $s3_url ); ?>" target="_blank"><?php esc_html_e( 'LINK', 'godam' ); ?></a>
					<?php
				}
			}
		}
	}

	/**
	 * Add bulk actions.
	 *
	 * @param array $actions Bulk actions.
	 *
	 * @return array $actions Bulk actions.
	 */
	public function add_bulk_actions( $actions ) {
		$actions['upload_to_s3'] = __( 'Upload to S3', 'godam' );
		return $actions;
	}

	/**
	 * Upload media to S3.
	 *
	 * @param array   $response Attachment response.
	 * @param WP_Post $attachment Attachment object.
	 *
	 * @return array $response Attachment response.
	 */
	public function add_media_folder_to_attachment( $response, $attachment ) {
		
		// Check if S3 url is present to S3 attachment meta.
		$s3_url = get_post_meta( $attachment->ID, 's3_url', true );

		if ( ! empty( $s3_url ) ) {
			$response['s3_url'] = $s3_url;
		} else {
			$response['s3_url'] = false;
		}

		return $response;
	}

	/**
	 * Filter the media library arguments to include folders.
	 * 
	 * @param array $query_args Query arguments.
	 *
	 * @return array
	 */
	public function filter_media_library_by_taxonomy( $query_args ) {

		if ( isset( $_REQUEST['query']['media-folder'] ) ) {
			$media_folder_id = intval( $_REQUEST['query']['media-folder'] );
		
			// Handle uncategorized folder (media-folder ID = 0).
			if ( 0 === $media_folder_id ) {
				$uncategorized_ids = get_terms(
					array(
						'taxonomy'   => 'media-folder',
						'fields'     => 'ids',
						'hide_empty' => false,
					)
				);
		
				$query_args['tax_query'] = array( // phpcs:ignore -- tax_query is required here to filter by taxonomy.
					array(
						'taxonomy'         => 'media-folder',
						'field'            => 'term_id',
						'terms'            => $uncategorized_ids,
						'operator'         => 'NOT IN',
						'include_children' => false,
					),
				);
			} elseif ( -1 !== $media_folder_id && ! empty( $media_folder_id ) ) {
				$query_args['tax_query'] = array( // phpcs:ignore -- tax_query is required here to filter by taxonomy.
					array(
						'taxonomy'         => 'media-folder',
						'field'            => 'term_id',
						'terms'            => $media_folder_id,
						'include_children' => false,
					),
				);
			}
		
			// Unset the 'media-folder' query arg regardless of the case.
			unset( $query_args['media-folder'] );
		}

		if ( isset( $_REQUEST['query']['date_query'] ) && is_array( $_REQUEST['query']['date_query'] ) ) {
			$query_args['date_query'] = $this->sanitize_date( $_REQUEST['query']['date_query'] ); // phpcs:ignore -- date_query is getting sanitized by custom function.
		}

		return $query_args;
	}

	/**
	 * Filter the media library by folder.
	 *
	 * @param Object $query Query object.
	 * @return void
	 */
	public function pre_get_post_filter( $query ) {
		if ( is_admin() && $query->is_main_query() && $query->get( 'post_type' ) === 'attachment' ) {
			$media_folder = isset( $_GET['media-folder'] ) ? sanitize_text_field( $_GET['media-folder'] ) : null;

			if ( $media_folder && 'uncategorized' === $media_folder ) {
				$query->set(
					'tax_query',
					array(
						array(
							'taxonomy' => 'media-folder',
							'field'    => 'term_id',
							'operator' => 'NOT IN',
							'terms'    => get_terms(
								array(
									'taxonomy'   => 'media-folder',
									'fields'     => 'ids',
									'hide_empty' => false,
								)
							),
						),
					) 
				);
	
			} elseif ( $media_folder && 'all' !== $media_folder ) {
				$query->set( // phpcs:ignore
					'tax_query',
					array(
						array(
							'taxonomy' => 'media-folder',
							'field'    => 'term_id',
							'terms'    => (int) $media_folder,
						),
					) 
				);
			}

			unset( $query->query_vars['media-folder'] );

			if ( isset( $_GET['date-start'] ) && isset( $_GET['date-end'] ) ) {
				$query->set(
					'date_query',
					array(
						'relation' => 'AND',
						array(
							'after' => sanitize_text_field( $_GET['date-start'] ),
						),
						array(
							'before' => sanitize_text_field( $_GET['date-end'] ),
						),
					)
				);
			}
		}
	}

	/**
	 * Add a dropdown filter to the media library.
	 *
	 * @return void
	 */
	public function restrict_manage_media_filter() {
		$screen = get_current_screen();
	
		if ( 'upload' === $screen->id ) {
			// Get the current folder filter value from the URL.
			$media_folder = isset( $_GET['media-folder'] ) ? sanitize_text_field( $_GET['media-folder'] ) : 'all';
	
			// Get all terms from the 'media-folder' taxonomy.
			$terms = get_terms(
				array(
					'taxonomy'   => 'media-folder',
					'hide_empty' => false,
				) 
			);
	
			// Define default options.
			$folders = array(
				(object) array(
					'id'   => 'uncategorized',
					'name' => __( 'Uncategorized', 'godam' ),
				),
				(object) array(
					'id'   => 'all',
					'name' => __( 'All collections', 'godam' ),
				),
			);
	
			// Add taxonomy terms to the folder list.
			foreach ( $terms as $term ) {
				$folders[] = (object) array(
					'id'   => $term->term_id,
					'name' => $term->name,
				);
			}
	
			// Render the dropdown.
			echo '<select id="media-folder-filter" name="media-folder" class="attachment-filters">';
			foreach ( $folders as $folder ) {
				printf(
					'<option value="%1$s" %3$s>%2$s</option>',
					esc_attr( $folder->id ),
					esc_html( $folder->name ),
					selected( $media_folder, $folder->id, false )
				);
			}
			echo '</select>';

			// Render the date range filter.
			echo '<input id="media-date-range-filter" />';
			echo '<input id="media-date-range-filter-start" name="date-start" />';
			echo '<input id="media-date-range-filter-end" name="date-end" />';
		}
	}

	/**
	 * Sanitize the date query.
	 * 
	 * Filter the date_query to only allow specific date formats and the valid relation.
	 *
	 * @param array $date_query Date query.
	 * 
	 * @return array $date_query sanitized date query.
	 */
	private function sanitize_date( $date_query ) {
		return array_filter(
			array_map(
				function ( $item ) {
					if ( is_array( $item ) ) {
						$sanitized_item = array();
						foreach ( $item as $key => $value ) {
							if ( 'after' === $key || 'before' === $key ) {
								// Validate date format (YYYY-MM-DD).
								if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
									$sanitized_item[ $key ] = $value;
								}
							} else {
								// Sanitize any other keys.
								$sanitized_item[ $key ] = sanitize_text_field( $value );
							}
						}
						return $sanitized_item;
					} else {
						$valid_relations = array( 'AND', 'OR' );
						return in_array( $item, $valid_relations, true ) ? sanitize_text_field( $item ) : null;
					}
					return null;
				},
				$date_query
			)
		);
	}
}
