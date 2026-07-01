<?php
/**
 * Render template for the GoDAM Document Block.
 *
 * @since 1.4.8
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$godam_attachment_id = ! empty( $attributes['id'] ) ? ( is_numeric( $attributes['id'] ) ? intval( $attributes['id'] ) : sanitize_text_field( $attributes['id'] ) ) : null;
$godam_caption       = ! empty( $attributes['caption'] ) ? $attributes['caption'] : '';
$godam_height        = ! empty( $attributes['height'] ) ? intval( $attributes['height'] ) : 600;
$godam_src           = ! empty( $attributes['src'] ) ? esc_url( $attributes['src'] ) : '';
$godam_preview_mode  = ! empty( $attributes['previewMode'] ) ? sanitize_text_field( $attributes['previewMode'] ) : 'default';
$godam_doc_title     = ! empty( $attributes['docTitle'] ) ? sanitize_text_field( $attributes['docTitle'] ) : '';
$godam_description   = ! empty( $attributes['description'] ) ? sanitize_textarea_field( $attributes['description'] ) : '';
$godam_show_cover    = ! empty( $attributes['showCover'] );
// customCover stores the URL of whichever tile the editor selected (auto or uploaded).
// Store raw; esc_url() is applied at output to avoid double-escaping.
$godam_custom_cover = ! empty( $attributes['customCover'] ) ? sanitize_url( $attributes['customCover'] ) : '';
$godam_page_count   = ! empty( $attributes['pageCount'] ) ? intval( $attributes['pageCount'] ) : 0;

if ( ! $godam_attachment_id && empty( $godam_src ) ) {
	return;
}

// Build the list of PDF sources (transcoded first, then original).
$godam_sources = array();
if ( ! empty( $godam_attachment_id ) && is_numeric( $godam_attachment_id ) ) {
	$godam_pdf_url            = wp_get_attachment_url( $godam_attachment_id );
	$godam_pdf_transcoded_url = get_post_meta( $godam_attachment_id, 'rtgodam_transcoded_url', true );
	if ( ! empty( $godam_pdf_transcoded_url ) ) {
		$godam_sources[] = $godam_pdf_transcoded_url;
	}
	if ( ! empty( $godam_pdf_url ) ) {
		$godam_sources[] = $godam_pdf_url;
	}

	// Fall back to attachment title for doc title if editor left it empty.
	if ( empty( $godam_doc_title ) ) {
		$godam_post      = get_post( $godam_attachment_id );
		$godam_doc_title = $godam_post ? get_the_title( $godam_post ) : '';
	}
} else {
	$godam_sources[] = $godam_src;
}

if ( empty( $godam_sources ) ) {
	return;
}

$godam_file_name = basename( $godam_sources[0] );

?>
<figure <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>

	<?php if ( 'card' === $godam_preview_mode ) : ?>

		<?php
		// Determine cover image — only when the "Show cover" toggle is on.
		$godam_cover_url = '';
		if ( $godam_show_cover ) {
			if ( $godam_custom_cover ) {
				$godam_cover_url = $godam_custom_cover;
			} elseif ( ! empty( $godam_attachment_id ) && is_numeric( $godam_attachment_id ) ) {
				// Mirror set_media_library_thumbnail(): video thumbnail (transcoding callback)
				// takes priority over pdf-specific key (GoDAM tab import).
				$godam_thumb = get_post_meta( $godam_attachment_id, 'rtgodam_media_video_thumbnail', true );
				if ( empty( $godam_thumb ) ) {
					$godam_thumb = get_post_meta( $godam_attachment_id, 'rtgodam_media_pdf_thumbnail', true );
				}
				if ( $godam_thumb ) {
					$godam_cover_url = $godam_thumb; // escaped at output below.
				}
			}
		}
		?>

		<div class="godam-pdf-card-wrapper" data-test-id="godam-pdf-render-card">
			<a
				class="godam-pdf-card"
				href="<?php echo esc_url( $godam_sources[0] ); ?>"
				target="_blank"
				rel="noopener noreferrer"
			>
				<div class="godam-pdf-card__cover">
					<?php if ( $godam_cover_url ) : ?>
						<img
							src="<?php echo esc_url( $godam_cover_url ); ?>"
							alt="<?php echo esc_attr( $godam_doc_title ?: $godam_file_name ); ?>"
						/>
					<?php else : ?>
						<div class="godam-pdf-card__cover-placeholder">
							<span class="dashicons dashicons-media-document"></span>
						</div>
					<?php endif; ?>
				</div>

				<div class="godam-pdf-card__info">
					<?php if ( $godam_doc_title ) : ?>
						<p class="godam-pdf-card__title">
							<?php echo esc_html( $godam_doc_title ); ?>
						</p>
					<?php endif; ?>

					<?php if ( $godam_description ) : ?>
						<p class="godam-pdf-card__description">
							<?php echo esc_html( $godam_description ); ?>
						</p>
					<?php endif; ?>

					<p class="godam-pdf-card__meta">
						<?php
						$godam_meta_parts = array();
						if ( $godam_page_count > 0 ) {
							/* translators: %d: number of pages */
							$godam_meta_parts[] = sprintf( _n( '%d page', '%d pages', $godam_page_count, 'godam' ), $godam_page_count );
						}
						if ( $godam_attachment_id ) {
							// wp_get_attachment_metadata() stores filesize in the DB —
							// works even when files are on S3 / CDN (no local file needed).
							$godam_att_meta = wp_get_attachment_metadata( $godam_attachment_id );
							$godam_filesize = isset( $godam_att_meta['filesize'] ) ? intval( $godam_att_meta['filesize'] ) : 0;
							// Fallback: try reading from disk (local installs).
							if ( ! $godam_filesize ) {
								$godam_local = get_attached_file( $godam_attachment_id );
								if ( $godam_local && file_exists( $godam_local ) ) {
									$godam_filesize = filesize( $godam_local );
								}
							}
							if ( $godam_filesize ) {
								$godam_meta_parts[] = $godam_filesize < 1048576
									? round( $godam_filesize / 1024 ) . ' KB'
									: number_format( $godam_filesize / 1048576, 1 ) . ' MB';
							}
						}
						echo esc_html( $godam_meta_parts ? implode( ' • ', $godam_meta_parts ) : $godam_file_name );
						?>
					</p>
				</div>
			</a>
		</div>

	<?php else : ?>

		<div
			class="godam-pdf-wrapper"
			data-test-id="godam-pdf-render"
			style="height: <?php echo esc_attr( $godam_height ); ?>px;"
		>
			<object
				id="pdfObject"
				type="application/pdf"
				width="100%"
				height="100%"
				data="<?php echo esc_url( $godam_sources[0] ); ?>"
				data-sources="<?php echo esc_attr( wp_json_encode( $godam_sources ) ); ?>"
			>
				<p>
					<?php
					echo wp_kses_post(
						sprintf(
							/* translators: %s: PDF download URL */
							__( 'Your browser does not support PDFs. <a href="%s">Download the PDF</a>.', 'godam' ),
							esc_url( $godam_sources[0] )
						)
					);
					?>
				</p>
			</object>
		</div>

	<?php endif; ?>

	<?php if ( $godam_caption ) : ?>
		<figcaption class="wp-element-caption">
			<?php echo wp_kses_post( $godam_caption ); ?>
		</figcaption>
	<?php endif; ?>

</figure>
