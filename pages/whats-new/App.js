/**
 * Internal dependencies
 */
import GoDAMIcon from './images/godam-icon.png';
import BannerImage from './images/banner.webp';
import SampleImage from './images/sample-image.webp';

const App = () => {
	return (
		<div className="godam-help-container">
			<header className="banner" style={ { backgroundImage: `url(${ BannerImage })` } }>
				<div className="banner-content">
					<h1>What&apos;s New in GoDAM</h1>
				</div>
			</header>

			<div className="godam-logo-container">
				<div className="godam-logo">
					<img src={ GoDAMIcon } alt="GoDAM Logo" />
				</div>
			</div>

			<section className="feature">
				<div className="container">
					<div className="feature-content">
						<div className="feature-image">
							<img src={ SampleImage } alt="Customize Chrome Toolbar" />
						</div>
						<div className="feature-text">
							<span className="tag">Central DAM</span>
							<h2>Central Media Manager</h2>
							<p>Manage your media from one place</p>
							<ol>
								<li>Media tabs to quickly filter between images, videos, audio, folders, and archived files, that will help you sort and find the file you need much faster.</li>
								<li>From the side panel, review the list of toolbar buttons that make it easy to quickly access things like bookmarks, print, Search with Google Lens, and more.</li>
								<li>Choose the toolbar buttons you want to pin and they will appear in your toolbar.</li>
							</ol>
						</div>
					</div>
				</div>
			</section>

			<section className="feature">
				<div className="container">
					<div className="feature-content reverse">
						<div className="feature-image">
							<img src={ SampleImage } alt="Google Lens in Chrome" />
						</div>
						<div className="feature-text">
							<span className="tag">MOBILE</span>
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

			<section className="more-features">
				<div className="container">
					<h2>Explore more features</h2>
					<div className="features-grid">

						<div className="feature-card" data-target="performance">
							<div className="card-image">
								<img src={ SampleImage } alt="Browser Performance" />
							</div>
							<div className="card-content">
								<h3>Improve your browser performance</h3>
							</div>
						</div>

						<div className="feature-card" data-target="security">
							<div className="card-image">
								<img src={ SampleImage } alt="Security Features" />
							</div>
							<div className="card-content">
								<h3>Check out more quickly and securely</h3>
							</div>
						</div>

						<div className="feature-card" data-target="search">
							<div className="card-image">
								<img src={ SampleImage } alt="Visual Search" />
							</div>
							<div className="card-content">
								<h3>Visual search with Google Lens</h3>
							</div>
						</div>
					</div>
				</div>
			</section>

			<div id="featureModal" className="modal">
				<div className="modal-content">
					<button className="close-button" onClick="closeModal()" aria-label="Close Modal">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-x" viewBox="0 0 16 16">
							<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
						</svg>
					</button>

					<div id="security" className="modal-body">
						<div className="feature-content reverse">
							<div className="feature-image">
								<img src={ SampleImage } alt="Google Lens in Chrome" />
							</div>
							<div className="feature-text">
								<span className="tag">MOBILE</span>
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

					<div id="performance" className="modal-body">
						<div className="feature-content reverse">
							<div className="feature-image">
								<img src={ SampleImage } alt="Google Lens in Chrome" />
							</div>
							<div className="feature-text">
								<span className="tag">MOBILE</span>
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

					<div id="search" className="modal-body">
						<div className="feature-content reverse">
							<div className="feature-image">
								<img src={ SampleImage } alt="Google Lens in Chrome" />
							</div>
							<div className="feature-text">
								<span className="tag">MOBILE</span>
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
		</div>
	);
};

export default App;
