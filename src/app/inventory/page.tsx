'use client';

import { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import {
  Stack,
  Title,
  Text,
  Card,
  Table,
  TextInput,
  Badge,
  Pagination,
  Group,
  Loader,
  Center,
} from '@mantine/core';
import { AppShell } from '../../components/layout/AppShell';
import { GetUnitsResponse, UnitData } from '../../types/graphql';

const GET_UNITS = gql`
  query GetUnits($page: Int, $pageSize: Int, $search: String) {
    getUnits(page: $page, pageSize: $pageSize, search: $search) {
      units {
        unitId
        totalQuantity
        availableQuantity
        expiryDate
        drug {
          medicationName
          genericName
          strength
          strengthUnit
        }
        lot {
          source
        }
      }
      total
      page
      pageSize
    }
  }
`;

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, loading } = useQuery<GetUnitsResponse>(GET_UNITS, {
    variables: { page, pageSize: 20, search: search || undefined },
  });

  const totalPages = data ? Math.ceil(data.getUnits.total / data.getUnits.pageSize) : 0;

  return (
    <AppShell>
      <Stack gap="xl">
        <div>
          <Title order={1}>Inventory</Title>
          <Text c="dimmed" size="sm">
            View and manage all units
          </Text>
        </div>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <TextInput
            placeholder="Search by drug name or notes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            mb="md"
          />

          {loading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : data?.getUnits.units && data.getUnits.units.length > 0 ? (
            <>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Medication</Table.Th>
                    <Table.Th>Generic Name</Table.Th>
                    <Table.Th>Strength</Table.Th>
                    <Table.Th>Available</Table.Th>
                    <Table.Th>Total</Table.Th>
                    <Table.Th>Expiry</Table.Th>
                    <Table.Th>Source</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data?.getUnits.units.map((unit: UnitData) => {
                    const isExpired = new Date(unit.expiryDate) < new Date();
                    const isExpiringSoon =
                      new Date(unit.expiryDate) <
                      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                    return (
                      <Table.Tr key={unit.unitId}>
                        <Table.Td>{unit.drug.medicationName}</Table.Td>
                        <Table.Td>{unit.drug.genericName}</Table.Td>
                        <Table.Td>
                          {unit.drug.strength} {unit.drug.strengthUnit}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={unit.availableQuantity > 0 ? 'green' : 'red'}>
                            {unit.availableQuantity}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{unit.totalQuantity}</Table.Td>
                        <Table.Td>
                          <Badge
                            color={isExpired ? 'red' : isExpiringSoon ? 'orange' : 'gray'}
                          >
                            {new Date(unit.expiryDate).toLocaleDateString()}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{unit.lot?.source}</Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>

              <Group justify="center" mt="md">
                <Pagination total={totalPages} value={page} onChange={setPage} />
              </Group>
            </>
          ) : (
            <Text c="dimmed">No units found</Text>
          )}
        </Card>
      </Stack>
    </AppShell>
  );
}
