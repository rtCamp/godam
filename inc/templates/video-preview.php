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

	?>
	<header class="godam-video-preview-header-wrapper">
		<div class="godam-video-preview-header">
			<div class="godam-video-preview-header--left">
				<div class="logo">
					<img class="logo-image" src="<?php echo esc_url( RTGODAM_URL . 'assets/images/godam-icon.svg' ); ?>" alt="<?php esc_attr_e( 'GoDAM Logo', 'godam' ); ?>">
					<h2 class="logo-text"><?php esc_html_e( 'Video Preview', 'godam' ); ?></h2>
				</div>
			</div>
			<div class="godam-video-preview-header--center"></div>
			<div class="godam-video-preview-header--right">
				<?php if ( $godam_video_id ) : ?>
					<!-- Video analytics link -->
					<?php if ( rtgodam_is_api_key_valid() ) : ?>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=rtgodam_analytics&id=' . $godam_video_id ) ); ?>" class="godam-button button-secondary">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.25 5h1.5v15h-1.5V5zM6 10h1.5v10H6V10zm12 4h-1.5v6H18v-6z"></path></svg>
						<?php esc_html_e( 'Analytics', 'godam' ); ?>
					</a>
					<?php endif; ?>
					<!-- Edit video link -->
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=rtgodam_video_editor&id=' . $godam_video_id ) ); ?>" class="godam-button button-primary">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="m19 7-3-3-8.5 8.5-1 4 4-1L19 7Zm-7 11.5H5V20h7v-1.5Z"></path></svg>
						<?php esc_html_e( 'Edit Video', 'godam' ); ?>
					</a>
				<?php endif; ?>
			</div>
		</div>
	</header>

	<main class="godam-video-preview-main">
		<div class="godam-video-preview-main--content">
			<?php
				echo $godam_preview_content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Content is escaped in the function.
			?>
		</div>
		<div class="godam-video-preview-main--sidebar">
			<div class="godam-pro-features">
				<h3 class="godam-pro-features__title"><?php esc_html_e( 'Our Pro Feature', 'godam' ); ?></h3>
				
				<ul class="godam-pro-features__list">
					<li class="godam-pro-features__list__item">
						<span class="godam-pro-features__icon dashicons dashicons-yes-alt"></span>
						<span><?php esc_html_e( 'Advanced Video Analytics', 'godam' ); ?></span>
					</li>
					<li class="godam-pro-features__list__item">
						<span class="godam-pro-features__icon dashicons dashicons-yes-alt"></span>
						<span><?php esc_html_e( 'Video Chapters & Markers', 'godam' ); ?></span>
					</li>
					<li class="godam-pro-features__list__item">
						<span class="godam-pro-features__icon dashicons dashicons-yes-alt"></span>
						<span><?php esc_html_e( 'Custom Video Player Branding', 'godam' ); ?></span>
					</li>
					<li class="godam-pro-features__list__item">
						<span class="godam-pro-features__icon dashicons dashicons-yes-alt"></span>
						<span><?php esc_html_e( 'Video Password Protection', 'godam' ); ?></span>
					</li>
					<li class="godam-pro-features__list__item">
						<span class="godam-pro-features__icon dashicons dashicons-yes-alt"></span>
						<span><?php esc_html_e( 'Bulk Video Processing', 'godam' ); ?></span>
					</li>
					<li class="godam-pro-features__list__item">
						<span class="godam-pro-features__icon dashicons dashicons-yes-alt"></span>
						<span><?php esc_html_e( 'Priority Support', 'godam' ); ?></span>
					</li>
				</ul>
				<div class="godam-pro-features__cta">
					<a 
						href="<?php echo esc_url( 'https://godam.io/pricing/?utm_campaign=buy-plan&utm_source=' . rawurlencode( wp_parse_url( home_url(), PHP_URL_HOST ) ) . '&utm_medium=plugin&utm_content=video-preview-sidebar' ); ?>" 
						class="godam-button button-primary"
						target="_blank"
						rel="noopener noreferrer"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-rocket-takeoff" viewBox="0 0 16 16">
							<path d="M9.752 6.193c.599.6 1.73.437 2.528-.362s.96-1.932.362-2.531c-.599-.6-1.73-.438-2.528.361-.798.8-.96 1.933-.362 2.532"/>
							<path d="M15.811 3.312c-.363 1.534-1.334 3.626-3.64 6.218l-.24 2.408a2.56 2.56 0 0 1-.732 1.526L8.817 15.85a.51.51 0 0 1-.867-.434l.27-1.899c.04-.28-.013-.593-.131-.956a9 9 0 0 0-.249-.657l-.082-.202c-.815-.197-1.578-.662-2.191-1.277-.614-.615-1.079-1.379-1.275-2.195l-.203-.083a10 10 0 0 0-.655-.248c-.363-.119-.675-.172-.955-.132l-1.896.27A.51.51 0 0 1 .15 7.17l2.382-2.386c.41-.41.947-.67 1.524-.734h.006l2.4-.238C9.005 1.55 11.087.582 12.623.208c.89-.217 1.59-.232 2.08-.188.244.023.435.06.57.093q.1.026.16.045c.184.06.279.13.351.295l.029.073a3.5 3.5 0 0 1 .157.721c.055.485.051 1.178-.159 2.065m-4.828 7.475.04-.04-.107 1.081a1.54 1.54 0 0 1-.44.913l-1.298 1.3.054-.38c.072-.506-.034-.993-.172-1.418a9 9 0 0 0-.164-.45c.738-.065 1.462-.38 2.087-1.006M5.205 5c-.625.626-.94 1.351-1.004 2.09a9 9 0 0 0-.45-.164c-.424-.138-.91-.244-1.416-.172l-.38.054 1.3-1.3c.245-.246.566-.401.91-.44l1.08-.107zm9.406-3.961c-.38-.034-.967-.027-1.746.163-1.558.38-3.917 1.496-6.937 4.521-.62.62-.799 1.34-.687 2.051.107.676.483 1.362 1.048 1.928.564.565 1.25.941 1.924 1.049.71.112 1.429-.067 2.048-.688 3.079-3.083 4.192-5.444 4.556-6.987.183-.771.18-1.345.138-1.713a3 3 0 0 0-.045-.283 3 3 0 0 0-.3-.041Z"/>
							<path d="M7.009 12.139a7.6 7.6 0 0 1-1.804-1.352A7.6 7.6 0 0 1 3.794 8.86c-1.102.992-1.965 5.054-1.839 5.18.125.126 3.936-.896 5.054-1.902Z"/>
						</svg>
						<?php esc_html_e( 'Upgrade to Pro', 'godam' ); ?>
					</a>
				</div>
			</div>
		</div>
	</main>
	<?php

	wp_footer();
	?>
</body>
</html>
