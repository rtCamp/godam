<?php
/**
 * Render template for the video editor layer in GoDAM.
 *
 * This file dynamically render video layer in the Video Editor page.
 *
 * Currently, this is mainly used for forms integration.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

defined( 'ABSPATH' ) || exit;

// Suppress Query Monitor's output for this template.
do_action( 'qm/cease' );

// We need to remove the admin bar for this template to avoid to display it on the video editor page.
add_filter( 'show_admin_bar', '__return_false' ); // phpcs:ignore WordPressVIPMinimum.UserExperience.AdminBarRemoval.RemovalDetected

$layer    = get_query_var( 'rtgodam-render-layer' );
$layer_id = get_query_var( 'rtgodam-layer-id' );
?>

<!DOCTYPE html>
<html <?php language_attributes(); ?>>
	<head>
		<meta charset="<?php bloginfo( 'charset' ); ?>">
		<meta name="viewport" content="width=device-width, initial-scale=1">

	<?php wp_head(); ?>

	<?php
	/**
	 * Action hook to allow additional content to be added before the layer is rendered.
	 *
	 * @since 1.4.0
	 *
	 * @param string $layer The type of layer being rendered.
	 * @param string $layer_id The ID of the layer being rendered.
	 */
	do_action( 'rtgodam_render_layer_for_video_editor_before', $layer, $layer_id );
	?>

	</head>

	<body <?php body_class(); ?>>
		<?php wp_body_open(); ?>
		<main id="primary" role="main">
			<?php
				/**
				 * Action hook to allow additional content to be added when the layer is rendered.
				 *
				 * @since 1.4.0
				 *
				 * @param string $layer The type of layer being rendered.
				 * @param string $layer_id The ID of the layer being rendered.
				 */
				do_action( 'rtgodam_render_layer_for_video_editor', $layer, $layer_id );
			?>
		</main>
	<?php
		/**
		 * Action hook to allow additional content to be added after the layer is rendered.
		 *
		 * @since 1.4.0
		 *
		 * @param string $layer The type of layer being rendered.
		 * @param string $layer_id The ID of the layer being rendered.
		 */
		do_action( 'rtgodam_render_layer_for_video_editor_after', $layer, $layer_id );
	?>
	<?php wp_footer(); ?>
	</body>
</html>
<?php
