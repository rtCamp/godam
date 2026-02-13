<?php
/**
 * Render template for the GoDAM Video Duration Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$godam_wrapper_attributes = get_block_wrapper_attributes();
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- WordPress core variable.
$attributes            = $block->attributes;
$godam_duration_format = isset( $attributes['durationFormat'] ) ? $attributes['durationFormat'] : 'default';

$godam_video_post_id = get_the_ID();

if ( $godam_video_post_id ) {

	// Get attachment ID from post meta.
	$godam_attachment_id = get_post_meta( $godam_video_post_id, '_godam_attachment_id', true );

	// Get video duration directly from attachment's meta.
	$godam_video_duration = absint( get_post_meta( $godam_attachment_id, '_video_duration', true ) );
}

// Format the duration using the formatting function.
$godam_formatted_duration = '';
if ( ! empty( $godam_video_duration ) ) {
	$godam_formatted_duration = rtgodam_block_format_video_duration( $godam_video_duration, $godam_duration_format );
}
?>

<?php if ( ! empty( $godam_formatted_duration ) ) : ?>
	<div <?php echo wp_kses_data( $godam_wrapper_attributes ); ?>>
		<time datetime="PT<?php echo esc_attr( $godam_video_duration ); ?>S"><?php echo esc_html( $godam_formatted_duration ); ?></time>
	</div>
<?php endif; ?>