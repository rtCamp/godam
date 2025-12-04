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

	// Check if video ID is provided and if video attachment exists.
	$godam_video_attachment = null;
	$godam_show_video       = false;

	if ( ! empty( $godam_video_id ) ) {
		$godam_video_attachment = get_post( $godam_video_id );
		$godam_show_video       = $godam_video_attachment && 'attachment' === $godam_video_attachment->post_type;
	}

	if ( ! $godam_show_video ) {
		// Display error message for missing or invalid video.
		?>
		<div class="godam-video-preview--container">
			<h1 class="godam-video-preview--title"><?php esc_html_e( 'Video Preview', 'godam' ); ?></h1>
			<p class="video-not-found"><?php esc_html_e( 'Oops! We could not locate your video', 'godam' ); ?></p>
		</div>
		<?php
	} else {
		// Display video content.
		?>
		<header class="godam-video-preview--container">
			<h1 class="godam-video-preview--title">
				<strong><?php esc_html_e( 'Video Preview: ', 'godam' ); ?></strong>
				<?php echo esc_html( get_the_title( $godam_video_id ) ); ?>
			</h1>
		</header>

		<div class="godam-video-preview--container">
			<div class="godam-video-preview--notice">
				<?php esc_html_e( 'Note: This is a simple video preview. The video player may display differently when added to a page based on theme styles.', 'godam' ); ?>
			</div>
		</div>

		<div class="godam-video-preview">
			<?php echo do_shortcode( '[godam_video id="' . $godam_video_id . '"]' ); ?>
		</div>
		<?php
	}
	?>

	<?php wp_footer(); ?>
</body>
</html>
