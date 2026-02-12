<?php
/**
 * GoDAM video preview template.
 *
 * @package godam
 * @since 1.2.0
 */

// Ensure this is being accessed via WordPress.
defined( 'ABSPATH' ) || exit;

// Enqueue styles for the video preview page.
wp_enqueue_style( 'godam-video-preview-style' );

$godam_video_id = isset( $_GET['id'] ) ? intval( wp_unslash( $_GET['id'] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- no nonce verification needed for this page.

$godam_preview_content = godam_preview_page_content( $godam_video_id );

// translators: %s: video ID.
$godam_page_title = empty( $godam_video_id ) ? __( 'Video Preview', 'godam' ) : sprintf( __( 'Video Preview: Attachment(%s)', 'godam' ), $godam_video_id );
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?php echo esc_html( $godam_page_title ); ?></title>
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
	<?php
	wp_body_open();

	echo $godam_preview_content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Content is escaped in the function.

	wp_footer();
	?>
</body>
</html>
