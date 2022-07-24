import { request, gql } from 'graphql-request'
import { GRAPH_API_LOTTERY } from 'config/constants/endpoints'
import { LotteryRoundGraphEntity, LotteryResponse } from 'state/types'
import { getRoundIdsArray, fetchMultipleLotteries } from './helpers'
import { getLotteryV2Address } from 'utils/addressHelpers'
import { getLotteryV2Contract } from 'utils/contractHelpers'

export const MAX_LOTTERIES_REQUEST_SIZE = 100

/* eslint-disable camelcase */
type LotteriesWhere = { id_in?: string[] }

const applyNodeDataToLotteriesGraphResponse = (
  nodeData: LotteryResponse[],
  graphResponse: LotteryRoundGraphEntity[],
  currentTicketId?: string
): LotteryRoundGraphEntity[] => {
  //   If no graph response - return node data
  // if (graphResponse.length === 0) {
    return nodeData.map((nodeRound) => {
      let sumWinningTickets = 0;
      nodeRound.countWinnersPerBracket.forEach(count => {
        sumWinningTickets += Number(count)
      })
      return {
        endTime: nodeRound.endTime,
        finalNumber: nodeRound.finalNumber.toString(),
        startTime: nodeRound.startTime,
        status: nodeRound.status,
        id: nodeRound.lotteryId.toString(),
        ticketPrice: nodeRound.priceTicketInCake,
        totalTickets: nodeRound.firstTicketIdNextLottery ? 
        (Number(nodeRound.firstTicketIdNextLottery) - Number(nodeRound.firstTicketId)).toString():  
        (Number(currentTicketId) - Number(nodeRound.firstTicketId)).toString(), // firstTicketIdNextLottery ? firstTicketIdNextLottery - firstTicketId : currentTicketId - firstTicketId
        totalUsers: nodeRound.firstTicketIdNextLottery ? 
        (Number(nodeRound.firstTicketIdNextLottery) - Number(nodeRound.firstTicketId)).toString():  
        (Number(currentTicketId) - Number(nodeRound.firstTicketId)).toString(), // use the same as totalTickets
        winningTickets: nodeRound.firstTicketIdNextLottery ? sumWinningTickets.toString() : '', // countWinnersPerBracket ? iterate through and sum
      }
    })
  // }

  // Populate all nodeRound data with supplementary graphResponse round data when available
  // const nodeRoundsWithGraphData = nodeData.map((nodeRoundData) => {
  //   const graphRoundData = graphResponse.find((graphResponseRound) => graphResponseRound.id === nodeRoundData.lotteryId)
  //   return {
  //     endTime: nodeRoundData.endTime,
  //     finalNumber: nodeRoundData.finalNumber.toString(),
  //     startTime: nodeRoundData.startTime,
  //     status: nodeRoundData.status,
  //     id: nodeRoundData.lotteryId,
  //     ticketPrice: graphRoundData?.ticketPrice,
  //     totalTickets: graphRoundData?.totalTickets,
  //     totalUsers: graphRoundData?.totalUsers,
  //     winningTickets: graphRoundData?.winningTickets,
  //   }
  // })

  // // Return the rounds with combined node + subgraph data, plus all remaining subgraph rounds.
  // const [lastCombinedDataRound] = nodeRoundsWithGraphData.slice(-1)
  // const lastCombinedDataRoundIndex = graphResponse
  //   .map((graphRound) => graphRound?.id)
  //   .indexOf(lastCombinedDataRound?.id)

  // const remainingSubgraphRounds = graphResponse ? graphResponse.splice(lastCombinedDataRoundIndex + 1) : []
  // const mergedResponse = [...nodeRoundsWithGraphData, ...remainingSubgraphRounds]
  // return mergedResponse
}

const lotteryAddress = getLotteryV2Address()
const lotteryContract = getLotteryV2Contract()

export const getGraphLotteries = async (
  first = MAX_LOTTERIES_REQUEST_SIZE,
  skip = 0,
  where: LotteriesWhere = {},
): Promise<LotteryRoundGraphEntity[]> => {
  try {
    const response = await request(
      GRAPH_API_LOTTERY,
      gql`
        query getLotteries($first: Int!, $skip: Int!, $where: Lottery_filter) {
          lotteries(first: $first, skip: $skip, where: $where, orderDirection: desc, orderBy: block) {
            id
            totalUsers
            totalTickets
            winningTickets
            status
            finalNumber
            startTime
            endTime
            ticketPrice
          }
        }
      `,
      { skip, first, where },
    )
    return response.lotteries
  } catch (error) {
    console.error(error)
    return []
  }
}

const getLotteriesData = async (currentLotteryId: string): Promise<LotteryRoundGraphEntity[]> => {
  const idsForNodesCall = getRoundIdsArray(currentLotteryId)
  const [nodeData, graphResponse] = await Promise.all([fetchMultipleLotteries(idsForNodesCall), getGraphLotteries()])
  const mergedData = applyNodeDataToLotteriesGraphResponse(nodeData, graphResponse, currentLotteryId)
  return mergedData
}

export default getLotteriesData
