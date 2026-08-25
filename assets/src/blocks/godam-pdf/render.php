<?php
/**
 * Render template for the GoDAM Document Block.
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

/**
 * Fires before reading this attachment's URL/transcoded-URL/title, so
 * integrations that centralize media on another site can switch context
 * first.
 *
 * @since 2.2.0
 */
do_action( 'rtgodam_before_attachment_lookup' );

try {
	/*
	 * Two URLs, and they are not interchangeable.
	 *
	 * $godam_preview_url is always a PDF: either the file itself, or the preview PDF GoDAM
	 * Central rendered from a Word / Excel / PowerPoint / OpenDocument / text upload. It is the
	 * only thing that may be handed to the viewer.
	 *
	 * $godam_download_url is always the file the author uploaded. It is the only thing that may
	 * be offered as a download — somebody who uploads report.xlsx and gets preview.pdf back
	 * will think something broke.
	 */
	$godam_preview_url  = rtgodam_get_document_preview_url( $godam_attachment_id, $godam_src );
	$godam_download_url = rtgodam_get_document_download_url( $godam_attachment_id, $godam_src );

	if ( ! empty( $godam_attachment_id ) && is_numeric( $godam_attachment_id ) ) {
		// Fall back to attachment title for doc title if editor left it empty.
		if ( empty( $godam_doc_title ) ) {
			$godam_post      = get_post( $godam_attachment_id );
			$godam_doc_title = $godam_post ? get_the_title( $godam_post ) : '';
		}
	}

	if ( empty( $godam_preview_url ) && empty( $godam_download_url ) ) {
		return;
	}

	/*
	 * Formats outside rtgodam_get_supported_document_types() have no preview to show, so emit
	 * nothing rather than an empty frame; the editors surface an "unsupported format" notice so
	 * the author can see and fix it.
	 *
	 * Checked against the original attachment id / src rather than the resolved URLs above,
	 * because a preview URL's extension no longer reflects the source file. A numeric id
	 * resolves via its stored MIME type, so $godam_src is only consulted for GoDAM tab media
	 * and URL-only documents, exactly the cases where $godam_src is guaranteed set.
	 */
	if ( ! godam_is_supported_document( $godam_attachment_id, $godam_src ) ) {
		return;
	}
} finally {
	do_action( 'rtgodam_after_attachment_lookup' );
}

// Named from the original, not the preview, so the card's fallback label reads
// "quarterly-report.xlsx" rather than "preview.pdf".
$godam_file_name = basename( ! empty( $godam_download_url ) ? $godam_download_url : $godam_preview_url );

// Root wrapper: in block context merge WordPress' block-support attributes
// (align/spacing/etc.). The [godam_document] shortcode (used by the WPBakery
// element) sets $godam_is_shortcode and runs outside a block, where
// get_block_wrapper_attributes() would raise a warning, so it instead applies
// any WPBakery Design Options CSS class passed in via $godam_css_class.
if ( empty( $godam_is_shortcode ) ) {
	$godam_wrapper_attributes = get_block_wrapper_attributes();
} else {
	$godam_shortcode_class    = trim( 'wp-block-godam-pdf ' . ( isset( $godam_css_class ) ? $godam_css_class : '' ) );
	$godam_wrapper_attributes = 'class="' . esc_attr( $godam_shortcode_class ) . '"';
}

?>
<figure <?php echo wp_kses_data( $godam_wrapper_attributes ); ?>>

	<?php if ( 'card' === $godam_preview_mode ) : ?>

		<?php
		// Determine cover image — only when the "Show cover" toggle is on.
		$godam_cover_url = '';
		if ( $godam_show_cover ) {
			if ( $godam_custom_cover ) {
				$godam_cover_url = $godam_custom_cover;
			} elseif ( ! empty( $godam_attachment_id ) && is_numeric( $godam_attachment_id ) ) {
				do_action( 'rtgodam_before_attachment_lookup' );
				// Mirror set_media_library_thumbnail(): video thumbnail (transcoding callback)
				// takes priority over pdf-specific key (GoDAM tab import).
				$godam_thumb = get_post_meta( $godam_attachment_id, 'rtgodam_media_video_thumbnail', true );
				if ( empty( $godam_thumb ) ) {
					$godam_thumb = get_post_meta( $godam_attachment_id, 'rtgodam_media_pdf_thumbnail', true );
				}
				do_action( 'rtgodam_after_attachment_lookup' );
				if ( $godam_thumb ) {
					$godam_cover_url = $godam_thumb; // escaped at output below.
				}
			}
		}
		?>

		<div class="godam-pdf-card-wrapper" data-test-id="godam-pdf-render-card">
			<a
				class="godam-pdf-card"
				href="<?php echo esc_url( $godam_download_url ? $godam_download_url : $godam_preview_url ); ?>"
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
							do_action( 'rtgodam_before_attachment_lookup' );
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
							do_action( 'rtgodam_after_attachment_lookup' );
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

		<?php if ( empty( $godam_preview_url ) ) : ?>

			<?php
			/*
			 * No preview exists. Either transcoding has not finished, or the file is
			 * password protected — GoDAM Central stores those as-is and reports them as
			 * successfully transcoded, but cannot convert a file it cannot open, so no
			 * preview is ever coming. The original is still downloadable either way.
			 *
			 * Rendered server-side so it works with JavaScript disabled.
			 */
			?>
			<div class="godam-pdf-unavailable" data-test-id="godam-pdf-render-unavailable">
				<span class="dashicons dashicons-media-document" aria-hidden="true"></span>
				<p class="godam-pdf-unavailable__text">
					<?php esc_html_e( 'A preview is not available for this document.', 'godam' ); ?>
				</p>
				<?php if ( ! empty( $godam_download_url ) ) : ?>
					<a
						class="godam-pdf-unavailable__download"
						href="<?php echo esc_url( $godam_download_url ); ?>"
						target="_blank"
						rel="noopener noreferrer"
					>
						<?php esc_html_e( 'Download original', 'godam' ); ?>
					</a>
				<?php endif; ?>
			</div>

		<?php else : ?>

			<?php
			/*
			 * The viewer is mounted by view.js, which renders the PDF page by page with
			 * pdf.js. No <object>/<iframe> here on purpose: those use the browser's own PDF
			 * viewer, whose toolbar shows the file name — and for a .docx upload a toolbar
			 * reading "preview.pdf" reads as a bug. view.js falls back to an <object> only
			 * if pdf.js itself fails to load.
			 *
			 * The download link inside doubles as the no-JavaScript fallback.
			 */
			?>
			<div
				class="godam-pdf-wrapper"
				data-test-id="godam-pdf-render"
				style="height: <?php echo esc_attr( $godam_height ); ?>px;"
				data-godam-preview="<?php echo esc_url( $godam_preview_url ); ?>"
				data-godam-download="<?php echo esc_url( $godam_download_url ); ?>"
				data-godam-title="<?php echo esc_attr( $godam_doc_title ? $godam_doc_title : $godam_file_name ); ?>"
			>
				<p class="godam-pdf-wrapper__fallback">
					<?php
					echo wp_kses_post(
						sprintf(
							/* translators: %s: original document download URL */
							__( 'This document cannot be displayed here. <a href="%s">Download it instead</a>.', 'godam' ),
							esc_url( $godam_download_url ? $godam_download_url : $godam_preview_url )
						)
					);
					?>
				</p>
			</div>

		<?php endif; ?>

	<?php endif; ?>

	<?php if ( $godam_caption ) : ?>
		<figcaption class="wp-element-caption">
			<?php echo wp_kses_post( $godam_caption ); ?>
		</figcaption>
	<?php endif; ?>

</figure>
