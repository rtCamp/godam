<?php
/**
 * Class to handle Media Folders.
 *
 * @package transcoder
 */

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

		add_filter( 'restrict_manage_posts', array( $this, 'restrict_manage_media_filter' ) );

	}

	/**
	 * Filter the media library arguments to include folders.
	 *
	 * @return void
	 */
	public function filter_media_library_by_taxonomy( $query_args ) {

		if ( isset( $_REQUEST['query']['media-folder'] ) ) {
			$media_folder_id = intval( $_REQUEST['query']['media-folder'] );
	
			if ( 0 === $media_folder_id ) {
				// Handling uncategorized attachments (no term selected for attachment).
				$query_args['tax_query'] = array(
					array(
						'taxonomy'         => 'media-folder',
						'field'            => 'term_id',
						'terms'            => get_terms(
							array(
								'taxonomy'   => 'media-folder',
								'fields'     => 'ids',
								'hide_empty' => false,
							)
						),
						'operator'         => 'NOT IN',
						'include_children' => false,
					),
				);
	
			} elseif ( -1 === $media_folder_id ) {
			}else if ( ! empty( $media_folder_id ) ) {
				// Filter attachments by selected folder.
				$query_args['tax_query'] = array(
					array(
						'taxonomy'         => 'media-folder',
						'field'            => 'term_id',
						'terms'            => $media_folder_id,
						'include_children' => false,
					),
				);
			}

			unset( $query_args['media-folder'] );

		}
	
		return $query_args;
	}

	public function pre_get_post_filter( $query ) {
		if ( is_admin() && $query->is_main_query() && $query->get( 'post_type' ) === 'attachment' ) {
			$media_folder = isset( $_GET['media-folder'] ) ? sanitize_text_field( $_GET['media-folder'] ) : null;

			if ( $media_folder && 'uncategorized' === $media_folder ) {
				$query->set( 'tax_query', array(
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
				) );
	
			} else if ( $media_folder && 'all' !== $media_folder ) {
				$query->set( 'tax_query', array(
					array(
						'taxonomy' => 'media-folder',
						'field'    => 'term_id',
						'terms'    => (int) $media_folder,
					),
				) );
			}

			unset( $query->query_vars['media-folder'] );
		}
	}

	function restrict_manage_media_filter() {
		$screen = get_current_screen();
	
		if ( $screen->id === 'upload' ) {
			// Get the current folder filter value from the URL
			$media_folder = isset( $_GET['media-folder'] ) ? sanitize_text_field( $_GET['media-folder'] ) : 'all';
	
			// Get all terms from the 'media-folder' taxonomy
			$terms = get_terms( array(
				'taxonomy'   => 'media-folder',
				'hide_empty' => false,
			) );
	
			// Define default options
			$folders = array(
				(object) array(
					'id'   => 'uncategorized',
					'name' => __( 'Uncategorized', 'textdomain' ),
				),
				(object) array(
					'id'   => 'all',
					'name' => __( 'All collections', 'textdomain' ),
				),
			);
	
			// Add taxonomy terms to the folder list
			foreach ( $terms as $term ) {
				$folders[] = (object) array(
					'id'   => $term->term_id,
					'name' => $term->name,
				);
			}
	
			// Render the dropdown
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
		}
	}
}
