import HTTPClient from '../HTTPClient'

const PaymentCardsService = {
  FetchAll(query) {
    return HTTPClient.get('/api/items' + query)
  },

  Get(id) {
    return HTTPClient.get(`/api/items/${id}`)
  },

  Create(data) {
    return HTTPClient.post('/api/items', data)
  },

  Update(id, data) {
    return HTTPClient.put(`/api/items/${id}`, data)
  },

  Delete(id) {
    return HTTPClient.delete(`/api/items/${id}`)
  }
}

export default PaymentCardsService
