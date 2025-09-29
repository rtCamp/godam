/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import Header from './Header';

const Features = ( { releaseData } ) => {
	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ activeFeatureId, setActiveFeatureId ] = useState( null );

	const version = releaseData.version ? releaseData.version : window.headerData?.version;
	const primaryUpdates = releaseData.features ? releaseData.features.slice( 0, 3 ) : [];
	const otherUpdates = releaseData.features ? releaseData.features.slice( 3 ) : [];

	const openModal = ( featureId ) => {
		setActiveFeatureId( featureId );
		setIsModalOpen( true );

		// Prevent scrolling on the body when modal is open.
		document.body.style.overflow = 'hidden';
	};

	const closeModal = () => {
		setIsModalOpen( false );
		setActiveFeatureId( null );

		// Restore scrolling when modal is closed.
		document.body.style.overflow = 'auto';
	};

	// Handle clicking outside modal (close modal).
	const handleOverlayClick = ( event ) => {
		if ( event.target === event.currentTarget ) {
			closeModal();
		}
	};

	// Handle escape key (close modal).
	useEffect( () => {
		const handleEscapeKey = ( event ) => {
			if ( event.key === 'Escape' && isModalOpen ) {
				closeModal();
			}
		};

		if ( isModalOpen ) {
			document.addEventListener( 'keydown', handleEscapeKey );
		}

		return () => {
			document.removeEventListener( 'keydown', handleEscapeKey );
		};
	}, [ isModalOpen ] );

	useEffect( () => {
		return () => {
			// Restore scrolling when component unmounts.
			document.body.style.overflow = 'auto';
		};
	}, [] );

	return (
		<div className="godam-whats-new-container">
			<Header version={ version } />

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
							<div
								className="feature-card"
								key={ feature.id }
								onClick={ () => openModal( feature.id ) }
								role="button"
								tabIndex={ 0 }
								onKeyDown={ ( event ) => {
									if ( event.key === 'Enter' || event.key === ' ' ) {
										event.preventDefault();
										openModal( feature.id );
									}
								} }
							>
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

			{ /* Modal */ }
			{ isModalOpen && (
				<div
					className="modal"
					onClick={ handleOverlayClick }
					aria-hidden="true"
				>
					<div className="modal-content">
						<button
							className="close-button"
							onClick={ closeModal }
							aria-label={ __( 'Close Modal' ) }
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-x" viewBox="0 0 16 16">
								<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
							</svg>
						</button>

						{ otherUpdates.map( ( feature ) => (
							<div
								key={ feature.id }
								className={ `modal-body ${ activeFeatureId === feature.id ? 'active' : '' }` }
							>
								<div className="feature-content-modal">
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
			) }
		</div>
	);
};

export default Features;
