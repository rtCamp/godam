<?php
/**
 * What's New page template file.
 *
 * @package GoDAM
 */

?>
<!-- Banner Section -->
<header class="banner">
	<div class="banner-content">
		<h1>What's New in GoDAM</h1>
	</div>
</header>

<div class="godam-logo-container">
	<div class="godam-logo">
		<img src="<?php echo esc_url( RTGODAM_URL . 'assets/images/logo.png' ); ?>" alt="Chrome Logo">
	</div>
</div>

<!-- Feature Section - Customize Toolbar -->
<section class="feature">
	<div class="container">
		<div class="feature-content">
			<div class="feature-image">
				<img src="customize-toolbar-2x.webp" alt="Customize Chrome Toolbar">
			</div>
			<div class="feature-text">
				<span class="tag">CUSTOMIZE</span>
				<h2>A new way to customize your toolbar</h2>
				<p>Pin your favorite features and shortcuts as toolbar buttons.</p>
				<ol>
					<li>At the top of your browser, select <strong>Chrome menu</strong> ⋮ > <strong>More Tools</strong> 🧰 > <strong>Customize Chrome</strong> 🔧.</li>
					<li>From the side panel, review the list of toolbar buttons that make it easy to quickly access things like bookmarks, print, Search with Google Lens, and more.</li>
					<li>Choose the toolbar buttons you want to pin and they will appear in your toolbar.</li>
				</ol>
			</div>
		</div>
	</div>
</section>

<!-- Mobile Feature Section -->
<section class="feature">
	<div class="container">
		<div class="feature-content reverse">
			<div class="feature-image">
				<img src="lenschrome-2x.webp" alt="Google Lens in Chrome">
				<div class="qr-code mobile-qr">
					<img src="lens-qr.png" alt="Google Lens QR Code">
				</div>
			</div>
			<div class="feature-text">
				<span class="tag">MOBILE</span>
				<h2>Search anything on your screen with Google Lens in Chrome</h2>
				<p>Draw, highlight, or tap to select anything you want to search and get results without leaving your tab.</p>
				<h3>iOS</h3>
				<ol>
					<li>Go to any web page in Chrome.</li>
					<li>In the address bar, tap on the Google Lens camera icon.</li>
					<li>Draw, highlight, or tap anything on your screen to search.</li>
				</ol>
			</div>
		</div>
	</div>
</section>

<!-- More Features Section -->
<section class="more-features">
	<div class="container">
		<h2>Explore more features</h2>
		<div class="features-grid">
			<!-- Feature Card 1 -->
			<div class="feature-card" data-target="performance">
				<div class="card-image">
					<img src="pdf-searchify-2x.webp" alt="Browser Performance">
				</div>
				<div class="card-content">
					<h3>Improve your browser performance</h3>
				</div>
			</div>

			<!-- Feature Card 2 -->
			<div class="feature-card" data-target="security">
				<div class="card-image">
					<img src="pdf-searchify-2x.webp" alt="Security Features">
				</div>
				<div class="card-content">
					<h3>Check out more quickly and securely</h3>
				</div>
			</div>

			<!-- Feature Card 3 -->
			<div class="feature-card" data-target="search">
				<div class="card-image">
					<img src="pdf-searchify-2x.webp" alt="Visual Search">
				</div>
				<div class="card-content">
					<h3>Visual search with Google Lens</h3>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Modal Container -->
<div id="featureModal" class="modal">
	<div class="modal-content">
		<span class="close-button">
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
				<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
			</svg>
		</span>

		<!-- Security Modal Content -->
		<div id="security" class="modal-body">
			<div class="feature-content reverse">
				<div class="feature-image">
					<img src="lenschrome-2x.webp" alt="Google Lens in Chrome">
				</div>
				<div class="feature-text">
					<span class="tag">MOBILE</span>
					<h2>Search anything on your screen with Google Lens in Chrome</h2>
					<p>Draw, highlight, or tap to select anything you want to search and get results without leaving your tab.</p>
					<h3>iOS</h3>
					<ol>
						<li>Go to any web page in Chrome.</li>
						<li>In the address bar, tap on the Google Lens camera icon.</li>
						<li>Draw, highlight, or tap anything on your screen to search.</li>
					</ol>
				</div>
			</div>
		</div>

		<!-- Performance Modal Content -->
		<div id="performance" class="modal-body">
			<div class="feature-content reverse">
				<div class="feature-image">
					<img src="lenschrome-2x.webp" alt="Google Lens in Chrome">
				</div>
				<div class="feature-text">
					<span class="tag">MOBILE</span>
					<h2>Search anything on your screen with Google Lens in Chrome</h2>
					<p>Draw, highlight, or tap to select anything you want to search and get results without leaving your tab.</p>
					<h3>iOS</h3>
					<ol>
						<li>Go to any web page in Chrome.</li>
						<li>In the address bar, tap on the Google Lens camera icon.</li>
						<li>Draw, highlight, or tap anything on your screen to search.</li>
					</ol>
				</div>
			</div>
		</div>

		<!-- Search Modal Content -->
		<div id="search" class="modal-body">
			<div class="feature-content reverse">
				<div class="feature-image">
					<img src="lenschrome-2x.webp" alt="Google Lens in Chrome">
				</div>
				<div class="feature-text">
					<span class="tag">MOBILE</span>
					<h2>Search anything on your screen with Google Lens in Chrome</h2>
					<p>Draw, highlight, or tap to select anything you want to search and get results without leaving your tab.</p>
					<h3>iOS</h3>
					<ol>
						<li>Go to any web page in Chrome.</li>
						<li>In the address bar, tap on the Google Lens camera icon.</li>
						<li>Draw, highlight, or tap anything on your screen to search.</li>
					</ol>
				</div>
			</div>
		</div>
	</div>
</div>