/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import Header from './Header';

const Features = ( { releaseData } ) => {
	const primaryUpdates = releaseData.features ? releaseData.features.slice( 0, 3 ) : [];
	const otherUpdates = releaseData.features ? releaseData.features.slice( 3 ) : [];

	return (
		<div className="godam-whats-new-container">
			<Header />

			{ primaryUpdates.map( ( feature, index ) => (
				<section className="feature" key={ index }>
					<div className="container">
						<div className={ `feature-content ${ index % 2 ? 'reverse' : '' }` }>
							<div className="feature-image">
								<img src={ feature.image } alt={ feature.title } />
							</div>
							<div className="feature-text">
								<h2>{ feature.title }</h2>
								<div className="feature-description" dangerouslySetInnerHTML={ { __html: feature.description } }></div>
							</div>
						</div>
					</div>
				</section>
			) ) }

			<section className="more-features">
				<div className="container">
					<h2>Explore more features</h2>
					<div className="features-grid">
						{ otherUpdates.map( ( feature ) => (
							<div className="feature-card" data-target={ feature.id } key={ feature.id }>
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

					{ otherUpdates.map( ( feature ) => (
						<div id={ feature.id } className="modal-body" key={ feature.id }>
							<div className="feature-content reverse">
								<div className="feature-image">
									<img src={ feature.image } alt={ feature.title } />
								</div>
								<div className="feature-text">
									<h2>{ feature.title }</h2>
									<div className="feature-description" dangerouslySetInnerHTML={ { __html: feature.description } }></div>
								</div>
							</div>
						</div>
					) ) }
				</div>
			</div>
		</div>
	);
};

export default Features;
