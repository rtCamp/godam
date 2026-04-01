<?php
/**
 * Server-side rendering of the `godam/gallery-v2` block.
 *
 * @package GoDAM
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'godam_gallery_v2_parse_id_list' ) ) {

	/**
	 * Parse a comma-separated ID list.
	 *
	 * @param string $value Raw attribute value.
	 * @return int[]
	 */
	function godam_gallery_v2_parse_id_list( $value ) {
		if ( ! is_string( $value ) || '' === trim( $value ) ) {
			return array();
		}

		$ids = array_map( 'trim', explode( ',', $value ) );
		$ids = array_map( 'absint', $ids );

		return array_values(
			array_filter(
				$ids,
				static fn( $id ) => $id > 0
			)
		);
	}
}

if ( ! function_exists( 'godam_gallery_v2_get_thumbnail_url' ) ) {

	/**
	 * Resolve the best available thumbnail for a video attachment.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return string
	 */
	function godam_gallery_v2_get_thumbnail_url( $attachment_id ) {
		$attachment_id = absint( $attachment_id );

		if ( ! $attachment_id ) {
			return '';
		}

		$custom_thumbnail = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
		if ( ! empty( $custom_thumbnail ) ) {
			return esc_url_raw( $custom_thumbnail );
		}

		$image = wp_get_attachment_image_url( $attachment_id, 'medium' );
		if ( $image ) {
			return $image;
		}

		$icon = wp_mime_type_icon( $attachment_id );
		if ( $icon ) {
			return $icon;
		}

		if ( defined( 'RTGODAM_URL' ) ) {
			return trailingslashit( RTGODAM_URL ) . 'assets/src/images/video-thumbnail-default.png';
		}

		return '';
	}
}

if ( ! function_exists( 'godam_gallery_v2_format_display_date' ) ) {

	/**
	 * Format a post date for gallery output.
	 *
	 * @param string $date_string Raw date string.
	 * @return string
	 */
	function godam_gallery_v2_format_display_date( $date_string ) {
		if ( empty( $date_string ) ) {
			return '';
		}

		$timestamp = strtotime( $date_string );

		return $timestamp ? wp_date( 'M j, Y', $timestamp ) : '';
	}
}

if ( ! function_exists( 'godam_gallery_v2_get_relative_date' ) ) {

	/**
	 * Get an ISO-like datetime string for a relative number of days.
	 *
	 * @param int $days Number of days back.
	 * @return string
	 */
	function godam_gallery_v2_get_relative_date( $days ) {
		$timestamp = strtotime( '-' . absint( $days ) . ' days' );

		return $timestamp ? gmdate( 'Y-m-d H:i:s', $timestamp ) : '';
	}
}

if ( ! function_exists( 'godam_gallery_v2_build_query_args' ) ) {

	/**
	 * Build attachment query args from block attributes.
	 *
	 * @param array $attributes Block attributes.
	 * @return array
	 */
	function godam_gallery_v2_build_query_args( $attributes ) {
		$media_folder_ids = godam_gallery_v2_parse_id_list( $attributes['mediaFolder'] ?? '' );
		$author_ids       = godam_gallery_v2_parse_id_list( $attributes['author'] ?? '' );
		$count            = isset( $attributes['count'] ) ? max( 1, absint( $attributes['count'] ) ) : 6;
		$orderby          = isset( $attributes['orderby'] ) ? sanitize_key( $attributes['orderby'] ) : 'date';
		$order            = isset( $attributes['order'] ) ? strtoupper( sanitize_key( $attributes['order'] ) ) : 'DESC';
		$date_range       = isset( $attributes['dateRange'] ) ? sanitize_key( $attributes['dateRange'] ) : '';
		$date_query       = array();

		if ( '7days' === $date_range ) {
			$date_query[] = array( 'after' => godam_gallery_v2_get_relative_date( 7 ) );
		} elseif ( '30days' === $date_range ) {
			$date_query[] = array( 'after' => godam_gallery_v2_get_relative_date( 30 ) );
		} elseif ( '90days' === $date_range ) {
			$date_query[] = array( 'after' => godam_gallery_v2_get_relative_date( 90 ) );
		} elseif ( 'custom' === $date_range ) {
			$after  = ! empty( $attributes['customDateStart'] ) ? gmdate( 'Y-m-d H:i:s', strtotime( $attributes['customDateStart'] ) ) : '';
			$before = ! empty( $attributes['customDateEnd'] ) ? gmdate( 'Y-m-d H:i:s', strtotime( $attributes['customDateEnd'] ) ) : '';

			if ( $after || $before ) {
				$date_filter = array();

				if ( $after ) {
					$date_filter['after'] = $after;
				}

				if ( $before ) {
					$date_filter['before'] = $before;
				}

				$date_query[] = $date_filter;
			}
		}

		$query_args = array(
			'post_type'              => 'attachment',
			'post_status'            => 'inherit',
			'post_mime_type'         => 'video',
			'posts_per_page'         => $count,
			'orderby'                => in_array( $orderby, array( 'date', 'title' ), true ) ? $orderby : 'date',
			'order'                  => in_array( $order, array( 'ASC', 'DESC' ), true ) ? $order : 'DESC',
			'ignore_sticky_posts'    => true,
			'no_found_rows'          => true,
			'update_post_meta_cache' => true,
			'update_post_term_cache' => true,
		);

		if ( ! empty( $media_folder_ids ) ) {
			$query_args['tax_query'] = array(
				array(
					'taxonomy' => 'media-folder',
					'field'    => 'term_id',
					'terms'    => $media_folder_ids,
				),
			);
		}

		if ( ! empty( $author_ids ) ) {
			$query_args['author__in'] = $author_ids;
		}

		if ( ! empty( $date_query ) ) {
			$query_args['date_query'] = $date_query;
		}

		return $query_args;
	}
}

if ( ! function_exists( 'godam_gallery_v2_get_video_data' ) ) {

	/**
	 * Resolve normalized video card data.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return array|null
	 */
	function godam_gallery_v2_get_video_data( $attachment_id ) {
		$attachment_id = absint( $attachment_id );
		$post          = $attachment_id ? get_post( $attachment_id ) : null;

		if ( ! $post || 'attachment' !== $post->post_type ) {
			return null;
		}

		return array(
			'id'        => $attachment_id,
			'title'     => get_the_title( $attachment_id ) ?: __( 'Untitled video', 'godam' ),
			'date'      => godam_gallery_v2_format_display_date( $post->post_date ),
			'thumbnail' => godam_gallery_v2_get_thumbnail_url( $attachment_id ),
		);
	}
}

$mode          = isset( $attributes['mode'] ) ? sanitize_key( $attributes['mode'] ) : 'handpicked';
$layout        = isset( $attributes['layout'] ) ? sanitize_key( $attributes['layout'] ) : 'carousel';
$view_ratio    = isset( $attributes['viewRatio'] ) ? sanitize_text_field( $attributes['viewRatio'] ) : '16:9';
$item_width    = isset( $attributes['itemWidth'] ) ? max( 180, absint( $attributes['itemWidth'] ) ) : 180;
$show_title    = ! isset( $attributes['showTitle'] ) || (bool) $attributes['showTitle'];
$ratio_class   = str_replace( ':', '-', $view_ratio );
$block_gap_raw = $attributes['style']['spacing']['blockGap'] ?? '16px';

if ( is_string( $block_gap_raw ) && str_starts_with( $block_gap_raw, 'var:preset|spacing|' ) ) {
	$block_gap = 'var(--wp--preset--spacing--' . str_replace( 'var:preset|spacing|', '', $block_gap_raw ) . ')';
} else {
	$block_gap = $block_gap_raw;
}

$inline_styles = sprintf(
	'--godam-gallery-item-width: %dpx; --godam-gallery-gap: %s;',
	$item_width,
	esc_attr( $block_gap )
);

$wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class'       => sprintf( 'godam-gallery-v2 godam-gallery-v2--%s', $mode ),
		'style'       => $inline_styles,
		'data-mode'   => $mode,
		'data-layout' => $layout,
		'data-ratio'  => $view_ratio,
	)
);

$items = array();

if ( 'query' === $mode ) {
	$query = new WP_Query( godam_gallery_v2_build_query_args( $attributes ) );

	if ( $query->have_posts() ) {
		foreach ( $query->posts as $video_post ) {
			$item = godam_gallery_v2_get_video_data( $video_post->ID );

			if ( $item ) {
				$items[] = $item;
			}
		}
	}

	wp_reset_postdata();
} elseif ( ! empty( $block->inner_blocks ) ) {
	foreach ( $block->inner_blocks as $inner_block ) {
		if ( 'godam/gallery-v2-item' !== $inner_block->name ) {
			continue;
		}

		$video_id = isset( $inner_block->attributes['videoId'] ) ? absint( $inner_block->attributes['videoId'] ) : 0;
		$item     = godam_gallery_v2_get_video_data( $video_id );

		if ( $item ) {
			$items[] = $item;
		}
	}
}

?>
<div <?php echo wp_kses_data( $wrapper_attributes ); ?>>
	<div class="<?php echo esc_attr( sprintf( 'godam-gallery-v2__canvas godam-gallery-v2__canvas--%s', $layout ) ); ?>">
		<?php if ( empty( $items ) ) : ?>
			<div class="godam-gallery-v2__state">
				<strong><?php esc_html_e( 'No videos found', 'godam' ); ?></strong>
				<p><?php esc_html_e( 'Try changing the selected folder, author, or dates.', 'godam' ); ?></p>
			</div>
		<?php elseif ( 'query' === $mode ) : ?>
			<div class="godam-gallery-v2__query-list">
				<?php foreach ( $items as $item ) : ?>
					<div class="<?php echo esc_attr( sprintf( 'godam-gallery-v2__query-item godam-gallery-v2__query-item--ratio-%s', $ratio_class ) ); ?>">
						<button
							type="button"
							class="godam-gallery-v2__query-button"
							data-godam-gallery-v2-trigger="true"
							data-video-id="<?php echo esc_attr( $item['id'] ); ?>"
							aria-label="<?php echo esc_attr( sprintf( __( 'Open video: %s', 'godam' ), $item['title'] ) ); ?>"
						>
							<div class="godam-gallery-v2__query-thumb">
								<?php if ( ! empty( $item['thumbnail'] ) ) : ?>
									<img src="<?php echo esc_url( $item['thumbnail'] ); ?>" alt="<?php echo esc_attr( $item['title'] ); ?>" loading="lazy" />
								<?php else : ?>
									<span><?php esc_html_e( 'GoDAM Video', 'godam' ); ?></span>
								<?php endif; ?>
							</div>
							<?php if ( $show_title ) : ?>
								<div class="godam-gallery-v2__query-meta">
									<strong><?php echo esc_html( $item['title'] ); ?></strong>
									<?php if ( ! empty( $item['date'] ) ) : ?>
										<span><?php echo esc_html( $item['date'] ); ?></span>
									<?php endif; ?>
								</div>
							<?php endif; ?>
						</button>
					</div>
				<?php endforeach; ?>
			</div>
		<?php else : ?>
			<div class="godam-gallery-v2__item-list">
				<?php foreach ( $items as $item ) : ?>
					<div class="<?php echo esc_attr( sprintf( 'godam-gallery-v2-item godam-gallery-v2-item--%s godam-gallery-v2-item--ratio-%s', $layout, $ratio_class ) ); ?>">
						<button
							type="button"
							class="godam-gallery-v2-item__button"
							data-godam-gallery-v2-trigger="true"
							data-video-id="<?php echo esc_attr( $item['id'] ); ?>"
							aria-label="<?php echo esc_attr( sprintf( __( 'Open video: %s', 'godam' ), $item['title'] ) ); ?>"
						>
							<div class="godam-gallery-v2-item__preview">
								<?php if ( ! empty( $item['thumbnail'] ) ) : ?>
									<img
										src="<?php echo esc_url( $item['thumbnail'] ); ?>"
										alt="<?php echo esc_attr( $item['title'] ); ?>"
										class="godam-gallery-v2-item__thumbnail"
										loading="lazy"
									/>
								<?php else : ?>
									<div class="godam-gallery-v2-item__placeholder">
										<span><?php esc_html_e( 'GoDAM Video', 'godam' ); ?></span>
									</div>
								<?php endif; ?>
								<div class="godam-gallery-v2-item__play-icon" aria-hidden="true">
									<svg viewBox="0 0 24 24" fill="currentColor">
										<path d="M8 5v14l11-7z" />
									</svg>
								</div>
							</div>
							<?php if ( $show_title ) : ?>
								<div class="godam-gallery-v2-item__meta">
									<div class="godam-gallery-v2-item__copy">
										<strong title="<?php echo esc_attr( $item['title'] ); ?>"><?php echo esc_html( $item['title'] ); ?></strong>
										<?php if ( ! empty( $item['date'] ) ) : ?>
											<span><?php echo esc_html( $item['date'] ); ?></span>
										<?php endif; ?>
									</div>
								</div>
							<?php endif; ?>
						</button>
					</div>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>
	</div>
</div>
