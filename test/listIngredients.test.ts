import { listIngredients } from '../lambda';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';

jest.mock('aws-sdk', () => {
    const mockScan = jest.fn();
    return {
        DynamoDB: {
            DocumentClient: jest.fn(() => ({
                scan: mockScan,
            })),
        },
        mockScan,  // Expose it for debugging
    };
});

const { mockScan } = AWS as any;

describe('listIngredients Lambda', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return a list of ingredients', async () => {
        mockScan.mockReturnValue({
            promise: jest.fn().mockResolvedValue({
                Items: [
                    { ingredient_id: 1, name: 'Vodka' },
                    { ingredient_id: 2, name: 'Rum' },
                ],
            }),
        });

        const event = {} as APIGatewayProxyEvent;
        const context = {} as Context;

        const response = await listIngredients(event, context);

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual([
            { id: 1, name: 'Vodka' },
            { id: 2, name: 'Rum' },
        ]);
    });

    it('should return an error response when DynamoDB fails', async () => {
        mockScan.mockReturnValue({
            promise: jest.fn().mockRejectedValue(new Error('DynamoDB error')),
        });

        const event = {} as APIGatewayProxyEvent;
        const context = {} as Context;

        const response = await listIngredients(event, context);

        expect(response.statusCode).toBe(500);
        expect(JSON.parse(response.body)).toHaveProperty('message', 'Error fetching data');
    });
});
