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
		$thumbnail_sources = rtgodam_get_video_thumbnail_sources( $attachment_id );

		return $thumbnail_sources['thumbnail'];
	}
}

if ( ! function_exists( 'godam_gallery_v2_get_placeholder_thumbnail_url' ) ) {

	/**
	 * Resolve the placeholder thumbnail for a video attachment.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return string
	 */
	function godam_gallery_v2_get_placeholder_thumbnail_url( $attachment_id ) {
		$thumbnail_sources = rtgodam_get_video_thumbnail_sources( $attachment_id );

		return $thumbnail_sources['placeholder'];
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
	 * @param int   $page       Results page number.
	 * @return array
	 */
	function godam_gallery_v2_build_query_args( $attributes, $page = 1 ) {
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
			'paged'                  => max( 1, absint( $page ) ),
			'orderby'                => in_array( $orderby, array( 'date', 'title' ), true ) ? $orderby : 'date',
			'order'                  => in_array( $order, array( 'ASC', 'DESC' ), true ) ? $order : 'DESC',
			'ignore_sticky_posts'    => true,
			'no_found_rows'          => false,
			'update_post_meta_cache' => true,
			'update_post_term_cache' => true,
		);

		if ( ! empty( $media_folder_ids ) ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- Tax query is necessary for folder filtering.
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
			'id'          => $attachment_id,
			'title'       => get_the_title( $attachment_id ) ?: __( 'Untitled video', 'godam' ),
			'date'        => godam_gallery_v2_format_display_date( $post->post_date ),
			'thumbnail'   => godam_gallery_v2_get_thumbnail_url( $attachment_id ),
			'placeholder' => godam_gallery_v2_get_placeholder_thumbnail_url( $attachment_id ),
		);
	}
}

$godam_gallery_mode        = isset( $attributes['mode'] ) ? sanitize_key( $attributes['mode'] ) : 'handpicked';
$godam_layout              = isset( $attributes['layout'] ) ? sanitize_key( $attributes['layout'] ) : 'carousel';
$godam_view_ratio          = isset( $attributes['viewRatio'] ) ? $attributes['viewRatio'] : '16:9';
$godam_allowed_ratios      = array( '16:9', '4:3', '9:16', '3:4', '1:1' );
$godam_view_ratio          = in_array( $godam_view_ratio, $godam_allowed_ratios, true ) ? $godam_view_ratio : '16:9';
$godam_item_width_size     = isset( $attributes['itemWidth'] ) ? $attributes['itemWidth'] : 'S';
$godam_item_width_map      = array(
	'S' => 200,
	'M' => 260,
	'L' => 320,
);
$godam_item_width          = isset( $godam_item_width_map[ $godam_item_width_size ] ) ? $godam_item_width_map[ $godam_item_width_size ] : 200;
$godam_show_title          = ! isset( $attributes['showTitle'] ) || (bool) $attributes['showTitle'];
$godam_performance_mode    = rtgodam_resolve_video_performance_mode( $attributes, 'balanced' );
$godam_enable_more_items   = array_key_exists( 'enableMoreItems', $attributes ) ? ! empty( $attributes['enableMoreItems'] ) : false;
$godam_more_items_behavior = isset( $attributes['moreItemsBehavior'] ) ? sanitize_key( $attributes['moreItemsBehavior'] ) : '';

if ( ! in_array( $godam_more_items_behavior, array( 'button', 'infinite' ), true ) ) {
	$godam_more_items_behavior = ! empty( $attributes['infiniteScroll'] ) ? 'infinite' : 'button';
}

if ( $godam_enable_more_items && 'carousel' === $godam_layout ) {
	$godam_more_items_behavior = 'infinite';
}

$godam_infinite_scroll       = $godam_enable_more_items && 'infinite' === $godam_more_items_behavior;
$godam_show_load_more_button = $godam_enable_more_items && 'button' === $godam_more_items_behavior;
$godam_ratio_class           = str_replace( ':', '-', $godam_view_ratio );
$godam_block_gap_raw         = $attributes['style']['spacing']['blockGap'] ?? '16px';
$godam_rest_query_args       = array();
$godam_total_query_items     = 0;

if ( is_string( $godam_block_gap_raw ) && 0 === strpos( $godam_block_gap_raw, 'var:preset|spacing|' ) ) {
	$godam_block_gap = 'var(--wp--preset--spacing--' . str_replace( 'var:preset|spacing|', '', $godam_block_gap_raw ) . ')';
} else {
	$godam_block_gap = $godam_block_gap_raw;
}

$godam_inline_styles = sprintf(
	'--godam-gallery-item-width: %dpx; --godam-gallery-gap: %s;',
	$godam_item_width,
	esc_attr( $godam_block_gap )
);

$godam_wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class'               => sprintf( 'godam-gallery-v2 godam-gallery-v2--%s', $godam_gallery_mode ),
		'style'               => $godam_inline_styles,
		'data-mode'           => $godam_gallery_mode,
		'data-layout'         => $godam_layout,
		'data-ratio'          => $godam_view_ratio,
		'data-embed-base-url' => home_url( '/' ),
		'data-engagements'    => rtgodam_is_engagement_feature_enabled() && ! empty( $attributes['engagements'] ) ? 'show' : '',
	)
);

$godam_items = array();

if ( 'query' === $godam_gallery_mode ) {
	$godam_rest_query_args   = array(
		'offset'            => 0,
		'columns'           => 1,
		'count'             => isset( $attributes['count'] ) ? max( 1, absint( $attributes['count'] ) ) : 6,
		'orderby'           => isset( $attributes['orderby'] ) ? sanitize_key( $attributes['orderby'] ) : 'date',
		'order'             => isset( $attributes['order'] ) ? strtoupper( sanitize_key( $attributes['order'] ) ) : 'DESC',
		'show_title'        => $godam_show_title ? '1' : '0',
		'layout'            => $godam_layout,
		'author'            => $attributes['author'] ?? '',
		'media_folder'      => $attributes['mediaFolder'] ?? '',
		'search'            => '',
		'date_range'        => $attributes['dateRange'] ?? '',
		'custom_date_start' => $attributes['customDateStart'] ?? '',
		'custom_date_end'   => $attributes['customDateEnd'] ?? '',
		'gallery_variant'   => 'gallery-v2',
		'view_ratio'        => $godam_view_ratio,
		'performance_mode'  => $godam_performance_mode,
	);
	$godam_query             = new WP_Query( godam_gallery_v2_build_query_args( $attributes, 1 ) );
	$godam_total_query_items = (int) $godam_query->found_posts;

	if ( $godam_query->have_posts() ) {
		foreach ( $godam_query->posts as $godam_video_post ) {
			$godam_item = godam_gallery_v2_get_video_data( $godam_video_post->ID );

			if ( $godam_item ) {
				$godam_items[] = $godam_item;
			}
		}
	}

	wp_reset_postdata();
} elseif ( ! empty( $block->inner_blocks ) ) {
	foreach ( $block->inner_blocks as $godam_inner_block ) {
		if ( 'godam/gallery-v2-item' !== $godam_inner_block->name ) {
			continue;
		}

		$godam_video_id = isset( $godam_inner_block->attributes['videoId'] ) ? absint( $godam_inner_block->attributes['videoId'] ) : 0;
		$godam_item     = godam_gallery_v2_get_video_data( $godam_video_id );

		if ( $godam_item ) {
			$godam_items[] = $godam_item;
		}
	}
}

?>
<div <?php echo wp_kses_data( $godam_wrapper_attributes ); ?>>
	<div class="<?php echo esc_attr( sprintf( 'godam-gallery-v2__canvas godam-gallery-v2__canvas--%s', $godam_layout ) ); ?>">
		<?php if ( empty( $godam_items ) ) : ?>
			<div class="godam-gallery-v2__state">
				<strong><?php esc_html_e( 'No videos found', 'godam' ); ?></strong>
				<p><?php esc_html_e( 'Try changing the selected folder, author, or dates.', 'godam' ); ?></p>
			</div>
		<?php elseif ( 'query' === $godam_gallery_mode ) : ?>
			<div
				class="godam-gallery-v2__query-area"
				data-query-rest-url="<?php echo esc_url( rest_url( 'godam/v1/gallery-shortcode' ) ); ?>"
				data-query-args="<?php echo esc_attr( wp_json_encode( $godam_rest_query_args ) ); ?>"
				data-current-offset="<?php echo esc_attr( count( $godam_items ) ); ?>"
				data-total-items="<?php echo esc_attr( $godam_total_query_items ); ?>"
				data-enable-more-items="<?php echo $godam_enable_more_items ? 'true' : 'false'; ?>"
				data-more-items-behavior="<?php echo esc_attr( $godam_more_items_behavior ); ?>"
				data-infinite-scroll="<?php echo $godam_infinite_scroll ? 'true' : 'false'; ?>"
				data-show-title="<?php echo $godam_show_title ? 'true' : 'false'; ?>"
				data-view-ratio="<?php echo esc_attr( $godam_view_ratio ); ?>"
			>
			<div class="godam-gallery-v2__query-list">
				<?php foreach ( $godam_items as $godam_index => $godam_item ) : ?>
					<?php $godam_thumbnail_attributes = rtgodam_format_html_attributes( rtgodam_get_gallery_tile_image_attributes( $godam_performance_mode, $godam_index ) ); ?>
					<div class="<?php echo esc_attr( sprintf( 'godam-gallery-v2__query-item godam-gallery-v2__query-item--ratio-%s', $godam_ratio_class ) ); ?>">
						<button
							type="button"
							class="godam-gallery-v2__query-button"
							data-godam-gallery-v2-trigger="true"
							data-video-id="<?php echo esc_attr( $godam_item['id'] ); ?>"
							<?php /* translators: %s: video title. */ ?>
							aria-label="<?php echo esc_attr( sprintf( __( 'Open video: %s', 'godam' ), $godam_item['title'] ) ); ?>"
						>
							<div class="godam-gallery-v2__query-thumb<?php echo ! empty( $godam_item['placeholder'] ) ? ' godam-gallery-blurred-img' : ''; ?>"<?php echo ! empty( $godam_item['placeholder'] ) ? ' style="background-image: url(\'' . esc_url( $godam_item['placeholder'] ) . '\')"' : ''; ?>>
								<?php if ( ! empty( $godam_item['thumbnail'] ) ) : ?>
									<img src="<?php echo esc_url( $godam_item['thumbnail'] ); ?>" alt="<?php echo esc_attr( $godam_item['title'] ); ?>" class="godam-gallery-v2__thumbnail" <?php echo $godam_thumbnail_attributes ? wp_kses_data( $godam_thumbnail_attributes ) : ''; ?> />
								<?php else : ?>
									<span><?php esc_html_e( 'GoDAM Video', 'godam' ); ?></span>
								<?php endif; ?>
							</div>
							<?php if ( $godam_show_title ) : ?>
								<div class="godam-gallery-v2__query-meta">
									<strong><?php echo esc_html( $godam_item['title'] ); ?></strong>
									<?php if ( ! empty( $godam_item['date'] ) ) : ?>
										<span><?php echo esc_html( $godam_item['date'] ); ?></span>
									<?php endif; ?>
								</div>
							<?php endif; ?>
						</button>
					</div>
				<?php endforeach; ?>
				<?php if ( $godam_total_query_items > count( $godam_items ) && $godam_show_load_more_button && 'carousel' === $godam_layout ) : ?>
					<div class="godam-gallery-v2__load-more-item">
						<button type="button" class="godam-gallery-v2__load-more wp-element-button">
							<?php esc_html_e( 'Load More', 'godam' ); ?>
						</button>
					</div>
				<?php endif; ?>
				<?php if ( $godam_infinite_scroll ) : ?>
					<div class="godam-gallery-v2__load-sentinel" aria-hidden="true"></div>
				<?php endif; ?>
			</div>
			<?php if ( $godam_total_query_items > count( $godam_items ) && $godam_show_load_more_button && 'carousel' !== $godam_layout ) : ?>
				<div class="godam-gallery-v2__load-more-wrap">
					<button type="button" class="godam-gallery-v2__load-more wp-element-button">
						<?php esc_html_e( 'Load More', 'godam' ); ?>
					</button>
				</div>
			<?php endif; ?>
			</div>
		<?php else : ?>
			<div class="godam-gallery-v2__item-list">
				<?php foreach ( $godam_items as $godam_index => $godam_item ) : ?>
					<?php $godam_thumbnail_attributes = rtgodam_format_html_attributes( rtgodam_get_gallery_tile_image_attributes( $godam_performance_mode, $godam_index ) ); ?>
					<div class="<?php echo esc_attr( sprintf( 'godam-gallery-v2-item godam-gallery-v2-item--%s godam-gallery-v2-item--ratio-%s', $godam_layout, $godam_ratio_class ) ); ?>">
						<button
							type="button"
							class="godam-gallery-v2-item__button"
							data-godam-gallery-v2-trigger="true"
							data-video-id="<?php echo esc_attr( $godam_item['id'] ); ?>"
							<?php /* translators: %s: video title. */ ?>
							aria-label="<?php echo esc_attr( sprintf( __( 'Open video: %s', 'godam' ), $godam_item['title'] ) ); ?>"
						>
							<div class="godam-gallery-v2-item__preview<?php echo ! empty( $godam_item['placeholder'] ) ? ' godam-gallery-blurred-img' : ''; ?>"<?php echo ! empty( $godam_item['placeholder'] ) ? ' style="background-image: url(\'' . esc_url( $godam_item['placeholder'] ) . '\')"' : ''; ?>>
								<?php if ( ! empty( $godam_item['thumbnail'] ) ) : ?>
									<img
										src="<?php echo esc_url( $godam_item['thumbnail'] ); ?>"
										alt="<?php echo esc_attr( $godam_item['title'] ); ?>"
										class="godam-gallery-v2-item__thumbnail godam-gallery-v2__thumbnail"
										<?php echo $godam_thumbnail_attributes ? wp_kses_data( $godam_thumbnail_attributes ) : ''; ?>
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
							<?php if ( $godam_show_title ) : ?>
								<div class="godam-gallery-v2-item__meta">
									<div class="godam-gallery-v2-item__copy">
										<strong title="<?php echo esc_attr( $godam_item['title'] ); ?>"><?php echo esc_html( $godam_item['title'] ); ?></strong>
										<?php if ( ! empty( $godam_item['date'] ) ) : ?>
											<span><?php echo esc_html( $godam_item['date'] ); ?></span>
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
