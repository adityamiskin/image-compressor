import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Compress from './pages/Compress';
import Footer from './components/Footer';
import PrivacyPolicy from './pages/PrivacyPolicy';

function App() {
	return (
		<>
			<BrowserRouter>
				<Routes>
					<Route path='/' element={<Compress />} />
					<Route path='privacy-policy' element={<PrivacyPolicy />} />
				</Routes>
			</BrowserRouter>
			<Footer />
		</>
	);
}

export default App;
