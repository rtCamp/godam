/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import GoDAMIcon from '../../../assets/src/images/godam-icon-colored.png';
import BannerImage from '../images/banner.webp';

const Header = ( { version } ) => {
	return (
		<>
			<header className="banner" style={ { backgroundImage: `url(${ BannerImage })` } }>
				<div className="banner-content">
					<div className="banner-content-meta">
						<div className="godam-logo">
							<img src={ GoDAMIcon } alt={ __( 'GoDAM Logo' ) } />
						</div>
						{ version && <span className="godam-version">v{ version }</span> }
					</div>

					<div className="banner-content-title">
						<h1>{ __( "What's New in GoDAM" ) }</h1>
					</div>
				</div>
			</header>
		</>
	);
};

export default Header;
