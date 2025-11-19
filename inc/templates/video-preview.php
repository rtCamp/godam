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

wp_head();

$video_id = isset( $_GET['id'] ) ? intval( wp_unslash( $_GET['id'] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- no nonce verification needed for this page.

if ( empty( $video_id ) ) {
	echo '<div class="godam-video-preview--container"><h1 class="godam-video-preview--title">' . esc_html__( 'Video Preview', 'godam' ) . '</h1>';
	echo '<p class="video-not-found">' . esc_html__( 'Oops! We could not locate your video', 'godam' ) . '</p><div>';
	return;
}

	// Check if video attachment exists.
	$video_attachment = get_post( $video_id );
if ( ! $video_attachment || 'attachment' !== $video_attachment->post_type ) {
	echo '<div class="godam-video-preview--container"><h1 class="godam-video-preview--title">' . esc_html__( 'Video Preview', 'godam' ) . '</h1>';
	echo '<p class="video-not-found">' . esc_html__( 'Oops! We could not locate your video', 'godam' ) . '</p></div>';
	return;
}
?>

	<header class="godam-video-preview--container">
		<h1 class="godam-video-preview--title">
			<strong><?php esc_html_e( 'Video Preview: ', 'godam' ); ?></strong>
			<?php echo esc_html( get_the_title( $video_id ) ); ?>
		</h1>
	</header>

	<div class="godam-video-preview--container">
		<div class="godam-video-preview--notice">
			<?php esc_html_e( 'Note: This is a simple video preview. The video player may display differently when added to a page based on theme styles.', 'godam' ); ?>
		</div>
	</div>

	<div class="godam-video-preview">
		<?php echo do_shortcode( '[godam_video id="' . $video_id . '"]' ); ?>
	</div>


<?php 
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- This hooks is not associated with godam plugin.
do_action( 'wp_footer' ); 
?>