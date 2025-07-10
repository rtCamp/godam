<?php
/**
 * Render template for the GoDAM Audio Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

?>
<h2 <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>
	<?php _e( 'GoDAM Video Thumbnail', 'godam' ); ?>
</h2>
