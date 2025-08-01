/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import GoDAMIcon from './images/godam-icon.png';
import BannerImage from './images/banner.webp';
import data from './data/release';

const App = () => {
	const [ majorReleaseData, setFeatures ] = useState( {} );

	useEffect( () => {
		const fetchData = async () => {
			try {
				const response = await fetch( '/wp-json/godam/v1/release-posts' );
				const resData = await response.json();
				setFeatures( resData );
			} catch ( error ) {
				setFeatures( data );
			}
		};

		fetchData();
	}, [] );

	useEffect( () => {
		if ( majorReleaseData.features && majorReleaseData.features.length > 0 ) {
			document.dispatchEvent( new CustomEvent( 'whatsNewContentReady' ) );
		}
	}, [ majorReleaseData ] );

	const primaryUpdates = majorReleaseData.features ? majorReleaseData.features.slice( 0, 3 ) : [];
	const otherUpdates = majorReleaseData.features ? majorReleaseData.features.slice( 3 ) : [];

	return (
		<div className="godam-help-container">
			<header className="banner" style={ { backgroundImage: `url(${ BannerImage })` } }>
				<div className="banner-content">
					<h1>{ __( "What's New in GoDAM" ) }</h1>
				</div>
			</header>

			<div className="godam-logo-container">
				<div className="godam-logo">
					<img src={ GoDAMIcon } alt={ __( 'GoDAM Logo' ) } />
				</div>
			</div>

			{ primaryUpdates.map( ( feature, index ) => (
				<section className="feature" key={ index }>
					<div className="container">
						<div className={ `feature-content ${ index % 2 ? 'reverse' : '' }` }>
							<div className="feature-image">
								<img src={ feature.image } alt={ feature.title } />
							</div>
							<div className="feature-text">
								<span className="tag">{ feature.tag }</span>
								<h2>{ feature.title }</h2>
								<p>{ feature.description }</p>
								<ol>
									{ feature?.points?.map( ( point, pointIndex ) => (
										<li key={ pointIndex }>{ point }</li>
									) ) }
								</ol>
							</div>
						</div>
					</div>
				</section>
			) ) }

			<section className="more-features">
				<div className="container">
					<h2>Explore more features</h2>
					<div className="features-grid">
						{ otherUpdates.map( ( feature, index ) => (
							<div className="feature-card" data-target={ feature.tag } key={ index }>
								<div className="card-image">
									<img src={ feature.image } alt={ feature.title } />
								</div>
								<div className="card-content">
									<h3>{ feature.title }</h3>
								</div>
							</div>
						) ) }
					</div>
				</div>
			</section>

			<div id="featureModal" className="modal">
				<div className="modal-content">
					<button className="close-button" onClick="closeModal()" aria-label={ __( 'Close Modal' ) }>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-x" viewBox="0 0 16 16">
							<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
						</svg>
					</button>

					{ otherUpdates.map( ( feature, index ) => (
						<div id={ feature.tag } className="modal-body" key={ index }>
							<div className="feature-content reverse">
								<div className="feature-image">
									<img src={ feature.image } alt={ feature.title } />
								</div>
								<div className="feature-text">
									<span className="tag">{ feature.tag }</span>
									<h2>{ feature.title }</h2>
									<p>{ feature.description }</p>
									<ol>
										{ feature?.points?.map( ( point, pointIndex ) => (
											<li key={ pointIndex }>{ point }</li>
										) ) }
									</ol>
								</div>
							</div>
						</div>
					) ) }
				</div>
			</div>
		</div>
	);
};

export default App;
