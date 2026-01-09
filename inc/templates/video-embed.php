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
$godam_show_engagements = isset( $_GET['engagements'] ) ? sanitize_text_field( wp_unslash( $_GET['engagements'] ) ) : false; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- no nonce verification needed for this page.

$godam_show_engagements = 'show' === strtolower( $godam_show_engagements ) ? true : false;

$godam_embed_content = godam_embed_page_content( $godam_video_id, $godam_show_engagements );

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

