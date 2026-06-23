/**
 * GoDAM brand mark + wordmark.
 *
 * @param {Object}  props            Props.
 * @param {boolean} [props.markOnly] Render only the mark (no wordmark).
 */
const BrandLogo = ( { markOnly = false } ) => (
	<span className="godam-onboarding__brand" data-test-id="godam-onboarding-brand">
		<svg className="godam-onboarding__brand-mark" width="32" height="32" viewBox="0 0 64 64" fill="none" aria-hidden="true">
			<path d="M25.5578 20.0911L8.05587 37.593L3.46397 33.0011C0.818521 30.3556 2.0821 25.8336 5.72228 24.9464L25.5632 20.0964L25.5578 20.0911Z" fill="currentColor" />
			<path d="M47.3773 21.8867L45.5438 29.3875L22.6972 52.2341L11.2605 40.7974L34.1662 17.8916L41.5703 16.0796C45.0706 15.2247 48.2323 18.3863 47.372 21.8813L47.3773 21.8867Z" fill="currentColor" />
			<path d="M43.5059 38.1036L38.6667 57.8907C37.7741 61.5255 33.2521 62.7891 30.6066 60.1436L26.0363 55.5732L43.5059 38.1036Z" fill="currentColor" />
		</svg>
		{ ! markOnly && <span className="godam-onboarding__brand-word">GoDAM</span> }
	</span>
);

export default BrandLogo;
