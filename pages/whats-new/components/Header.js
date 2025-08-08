/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import GoDAMIcon from '../images/godam-icon.png';
import BannerImage from '../images/banner.webp';

const Header = () => {
	return (
		<>
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
		</>
	);
};

export default Header;
