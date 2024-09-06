const { app } = require('@azure/functions');
const axios = require('axios');
const cheerio = require('cheerio');


module.exports = app.http('hubspot', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);
        const name = request.query.name || request.body.name;
        let results = [];
        if (name) {
            results = await isSolarChecker(name);
        }
        const isSolar = results.some(result => result.isSolar);
        return { body: JSON.stringify({ isSolar }), headers: { 'Content-Type': 'application/json' } };
    }
});

const getGoogleSearchResults = async (searchQuery) => {
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' company')}`;
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
            }
        });
        const $ = cheerio.load(data);
        const links = [];
        const excludedDomains = [
            'facebook.com', 'linkedin.com', 'instagram.com', 'youtube.com', 'pinterest.com',
            'wikipedia.org', 'google.com', 'twitter.com', 'amazon.com', 'yelp.com', 'tripadvisor.com', 
            'glassdoor.com', 'yellowpages.com'
        ];

        $('a').each((i, link) => {
            const href = $(link).attr('href');
            if (href && href.startsWith('/url?')) {
                const urlParams = new URLSearchParams(href);
                const actualUrl = urlParams.get('url');
                if (actualUrl && actualUrl.startsWith('https://')) {
                    const domain = new URL(actualUrl).hostname;
                    if (!excludedDomains.some(excludedDomain => domain.includes(excludedDomain))) {
                        links.push(actualUrl);
                    }
                }
            }
        });
        return links;
    } catch (error) {
        console.error('Error fetching the Google search results:', error);
        return [];
    }
};

const checkIsSolar = async (url) => {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const text = $('body').text().toLowerCase();
        return text.includes('solar');
    } catch (error) {
        console.error('Error fetching the URL:', error);
        return false;
    }
};

const isSolarChecker = async (searchQuery) => {
    const links = await getGoogleSearchResults(searchQuery);
    console.log('Filtered HTTPS URLs from Google search results:', links);
    const results = [];
    for (let i = 0; i < links.length && i < 2; i++) {  // Limit to 2 URLs
        const url = links[i];
        const isSolar = await checkIsSolar(url);
        results.push({ url, isSolar });
    }
    return results;
}
