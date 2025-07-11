/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
/**
 * Internal dependencies
 */
import Customize from '../../assets/src/images/customize.png';
import Folder from '../../assets/src/images/folder.png';
import WebDesign from '../../assets/src/images/web-design.png';
import GodamHeader from '../godam/components/GoDAMHeader.jsx';
import { Icon } from '@wordpress/components';
import { chevronRight } from '@wordpress/icons';
import GoDAMFooter from '../godam/components/GoDAMFooter.jsx';

const App = () => {
	const content = [
		{
			section_name: 'Settings and configuration',
			articles_list: [
				{
					title: __( 'General Settings', 'godam' ),
					link: 'settings-and-configuration/general-settings/',
				},
				{
					title: __( 'Video Settings', 'godam' ),
					link: 'settings-and-configuration/video-settings/',
				},
				{
					title: __( 'Configuring the Video Block', 'godam' ),
					link: 'section/configuring-the-video-block',
				},
			],
			icon: Customize,
		},
		{
			section_name: 'Appearance Settings',
			articles_list: [
				{
					title: __( 'Appearance Customisation', 'godam' ),
					link: 'appearance-settings/appearance-customization/',
				},
				{
					title: __( 'Call To Actions', 'godam' ),
					link: 'features/call-to-actions-ctas/',
				},
				{
					title: __( 'Hotspots', 'godam' ),
					link: 'features/hotspots/',
				},
				{
					title: __( 'Forms', 'godam' ),
					link: 'features/forms/',
				},
				{
					title: __( 'ADs', 'godam' ),
					link: 'features/ads/',
				},
			],
			icon: WebDesign,
		},
		{
			section_name: 'DAM',
			articles_list: [
				{
					title: __( 'Interface', 'godam' ),
					link: 'dam/interface/',
				},
				{
					title: __( 'How Tos', 'godam' ),
					link: 'dam/how-tos/',
				},
			],
			icon: Folder,
		},
	];

	const colors = [ '#fffacd', '#a2d5f2', '#b2f2bb' ];
	const [ input, setInput ] = useState( '' );

	const handleSearchSubmit = ( e ) => {
		e.preventDefault();
		if ( input.length === 0 ) {
			return;
		}
		const encodedInputValue = encodeURIComponent( input );

		const newUrl = `https://godam.io/?s=${ encodedInputValue }&post_type=docs`;

		window.open( newUrl, '_blank' );
	};
	return (
		<div className="godam-help-container">
			<GodamHeader />
			<div className="godam-hero-container max-w-[1260px] mx-auto px-4">
				<section>
					<div className="hero-content">
						<h1 className="hero-text">{ __( 'Hi, How can we help?', 'godam' ) }</h1>
						<h2>{ __( 'Welcome to the GoDAM Help Center!', 'godam' ) }</h2>
						<p>
							{ __(
								'Click on the documentation links below to find step-by-step guides, FAQs, and troubleshooting tips for the features you need help with.',
								'godam',
							) }
						</p>
						<div className="search">
							<form
								role="search"
								className="form-field shadow-search rounded w-full p-1 mb-0"
								onSubmit={ handleSearchSubmit }
							>
								<input
									className="search-field w-full"
									type="search"
									placeholder={ __( 'Search using keywords', 'godam' ) }
									autoComplete="off"
									aria-label={ __( 'Search using keywords', 'godam' ) }
									onChange={ ( e ) => setInput( e.target.value ) }
									value={ input }
								/>
							</form>
							<svg
								className="search-icon"
								width="16"
								height="16"
								viewBox="0 0 16 16"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									fillRule="evenodd"
									clipRule="evenodd"
									d="M2.75 7.33333C2.75 4.80203 4.80203 2.75 7.33333 2.75C9.86464 2.75 11.9167 4.80203 11.9167 7.33333C11.9167 8.56597 11.4301 9.68496 10.6385 10.5087C10.6146 10.5274 10.5916 10.5477 10.5696 10.5697C10.5477 10.5917 10.5273 10.6146 10.5087 10.6385C9.68494 11.4301 8.56596 11.9167 7.33333 11.9167C4.80203 11.9167 2.75 9.86464 2.75 7.33333ZM11.0719 12.1326C10.0405 12.9373 8.74289 13.4167 7.33333 13.4167C3.9736 13.4167 1.25 10.6931 1.25 7.33333C1.25 3.9736 3.9736 1.25 7.33333 1.25C10.6931 1.25 13.4167 3.9736 13.4167 7.33333C13.4167 8.7429 12.9373 10.0405 12.1326 11.072L14.5303 13.4697C14.8232 13.7626 14.8232 14.2374 14.5303 14.5303C14.2374 14.8232 13.7625 14.8232 13.4696 14.5303L11.0719 12.1326Z"
									fill="#ab3a6c"
								></path>
							</svg>
						</div>
					</div>
				</section>
			</div>
			<div className="flex justify-center flex-wrap gap-8 py-6 max-w-[1260px] mx-auto px-4">
				{ content.map( ( section, index ) => (
					<div key={ index } className="single-container">
						<div
							className="single-container-img"
							style={ { backgroundColor: colors[ index ] } }
						>
							<img
								src={ section.icon }
								height={ 50 }
								width={ 50 }
								alt={ section.section_name }
							/>
						</div>

						<div className="single-container-content">
							<h3>{ section.section_name }</h3>
							<ul>
								{ section.articles_list.map( ( article ) => (
									<li key={ article.section_name }>
										<Icon className="icon" icon={ chevronRight } />
										<a
											target="_blank"
											href={ `https://godam.io/docs/${ article.link }` }
											rel="noreferrer"
										>
											{ article.title }
										</a>
									</li>
								) ) }
							</ul>
						</div>
					</div>
				) ) }
			</div>

			<GoDAMFooter />
		</div>
	);
};

export default App;
