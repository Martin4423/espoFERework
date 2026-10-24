<?php

namespace Espo\Custom\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\ORM\EntityManager;
use Espo\Core\Utils\Config;
use Espo\Entities\Portal;

class GetPortalPublicBranding implements Action
{
    public function __construct(
        private EntityManager $entityManager,
        private Config $config,
    ) {}

    public function process(Request $request): Response
    {
        $path = $this->normalizePath((string) ($request->getQueryParam('path') ?? '/'));
        $host = strtolower((string) ($request->getQueryParam('host') ?? ''));
        $repository = $this->entityManager->getRDBRepositoryByClass(Portal::class);
        $portal = null;

        if (preg_match('#^portal(?:/([^/]+))?$#', $path, $matches)) {
            $id = $matches[1] ?? $this->config->get('defaultPortalId');
            if ($id) {
                $portal = $repository->where(['id' => $id, 'isActive' => true])->findOne();
                if (!$portal) {
                    $portal = $repository->where(['customId' => $id, 'isActive' => true])->findOne();
                }
            }
        } else {
            foreach ($repository->where(['isActive' => true])->find() as $candidate) {
                $customUrl = (string) $candidate->get('customUrl');
                if ($customUrl === '') {
                    continue;
                }

                $urlParts = parse_url($customUrl);
                $customPath = $this->normalizePath((string) ($urlParts['path'] ?? '/'));
                $customHost = strtolower((string) ($urlParts['host'] ?? ''));

                if ($customPath !== $path || ($customHost !== '' && $host !== '' && $customHost !== $host)) {
                    continue;
                }

                $portal = $candidate;
                break;
            }
        }

        if (!$portal) {
            return ResponseComposer::json([
                'portal' => false,
                'applicationName' => $this->config->get('applicationName') ?: 'EspoCRM',
                'companyLogoId' => $this->config->get('companyLogoId'),
                'logoSrc' => $this->config->get('logoSrc') ?: 'client/img/logo.svg',
                'theme' => $this->config->get('theme') ?: 'Espo',
            ]);
        }

        $themeParams = $portal->get('themeParams');
        $navbar = is_object($themeParams) ? ($themeParams->navbar ?? 'side') : (is_array($themeParams) ? ($themeParams['navbar'] ?? 'side') : 'side');

        return ResponseComposer::json([
            'portal' => true,
            'name' => $portal->get('name'),
            'applicationName' => $portal->get('applicationName') ?: $portal->get('name'),
            'companyLogoId' => $portal->get('companyLogoId'),
            'theme' => $portal->get('theme') ?: $this->config->get('theme'),
            'themeParams' => (object) ['navbar' => $navbar],
        ]);
    }

    private function normalizePath(string $path): string
    {
        $path = parse_url($path, PHP_URL_PATH) ?: '/';
        return trim(rawurldecode($path), '/');
    }
}
