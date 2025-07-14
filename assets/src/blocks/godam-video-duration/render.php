<?php
/**
 * Render template for the GoDAM Video Thumbnail Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<?php
$wrapper_attributes = get_block_wrapper_attributes(
	array(
		'class' => 'godam-video-duration',
	)
);
?>

<div <?php echo wp_kses_data( $wrapper_attributes ); ?>>
	<h1><?php __( 'Video Duration', 'godam' ); ?></h1>
</div>