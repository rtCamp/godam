<?php
/**
 * GoDAM video embed template.
 *
 * @package godam
 * @since 1.2.0
 */

// Ensure this is being accessed via WordPress.
defined( 'ABSPATH' ) || exit;

// Enqueue styles and scripts for the video embed page.
wp_enqueue_style( 'godam-video-embed-style' );
wp_enqueue_script( 'godam-video-embed-script' );

$godam_video_id         = isset( $_GET['id'] ) ? intval( wp_unslash( $_GET['id'] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- no nonce verification needed for this page.
$godam_video_transcoded = sanitize_text_field( (string) get_post_meta( $godam_video_id, 'rtgodam_transcoding_status', true ) );
$godam_context          = isset( $_GET['godam_context'] ) ? sanitize_text_field( wp_unslash( $_GET['godam_context'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- no nonce verification needed for this page.
$godam_bg_color         = isset( $_GET['bg'] ) ? sanitize_hex_color( '#' . ltrim( wp_unslash( $_GET['bg'] ), '#' ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- no nonce verification needed for this page.
$godam_show_engagements = isset( $_GET['engagements'] ) ? sanitize_text_field( wp_unslash( $_GET['engagements'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- no nonce verification needed for this page.
$godam_show_engagements = rtgodam_is_engagement_feature_enabled() && rtgodam_is_api_key_valid() && 'transcoded' === strtolower( $godam_video_transcoded ) && in_array( strtolower( $godam_show_engagements ), array( '1', 'true', 'on', 'show' ), true );

// Analytics placement attribution: gallery iframes pass the host page's post
// ID and a block_source slug so plays attribute to the embedding page.
$godam_host_post_id = isset( $_GET['host_post_id'] ) ? absint( wp_unslash( $_GET['host_post_id'] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- no nonce verification needed for this page.
// mb_substr, not substr: a byte-wise cut can split a multibyte character, and
// esc_attr() then discards the whole invalid-UTF-8 value, losing the attribution.
$godam_block_source = isset( $_GET['block_source'] ) ? mb_substr( sanitize_text_field( wp_unslash( $_GET['block_source'] ) ), 0, 100, 'UTF-8' ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- no nonce verification needed for this page.

$godam_embed_content = godam_embed_page_content( $godam_video_id, $godam_context, $godam_bg_color, $godam_show_engagements, $godam_block_source, $godam_host_post_id );

// translators: %s: video ID.
$godam_page_title = empty( $godam_video_id ) ? __( 'Video Embed', 'godam' ) : sprintf( __( 'Video Embed: Attachment(%s)', 'godam' ), $godam_video_id );
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
	<title><?php echo esc_html( $godam_page_title ); ?></title>
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'godam-embed-page' ); ?>>
	<?php
	wp_body_open();

	echo $godam_embed_content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Content is escaped in the function.

	wp_footer();
	?>
</body>
</html>

